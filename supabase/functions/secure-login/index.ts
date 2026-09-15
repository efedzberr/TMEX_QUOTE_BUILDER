import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface Policy {
  max_login_attempts: number | null;
  lockout_minutes: number | null;
  expiration_days: number | null;
}

interface Security {
  failed_login_attempts: number;
  locked_until: string | null;
  locked_forever: boolean;
  password_changed_at: string;
  must_change_password: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const service = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim()
    || req.headers.get("cf-connecting-ip")
    || req.headers.get("x-real-ip")
    || null;
  const userAgent = req.headers.get("user-agent");

  let email = "";
  let password = "";
  try {
    const body = await req.json();
    email = String(body.email || "").trim();
    password = String(body.password || "");
  } catch {
    return jsonResponse({ error: "bad_request" }, 400);
  }
  if (!email || !password) return jsonResponse({ error: "bad_request" }, 400);

  const log = async (status: string, userId: string | null) => {
    const { data } = await service
      .from("login_history")
      .insert({ user_id: userId, email, status, ip, user_agent: userAgent })
      .select("id")
      .single();
    return (data as { id: number } | null)?.id ?? null;
  };

  try {
    // Resolve the account
    const { data: userId } = await service.rpc("security_user_id_by_email", { p_email: email });
    if (!userId) {
      await log("unknown_user", null);
      return jsonResponse({ error: "invalid_credentials" }, 401);
    }

    const { data: policyRow } = await service
      .from("password_policies")
      .select("max_login_attempts, lockout_minutes, expiration_days")
      .eq("id", 1)
      .maybeSingle();
    const policy: Policy = (policyRow as Policy) || { max_login_attempts: null, lockout_minutes: null, expiration_days: null };

    await service.from("user_security").upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });
    const { data: secRow } = await service
      .from("user_security")
      .select("failed_login_attempts, locked_until, locked_forever, password_changed_at, must_change_password")
      .eq("user_id", userId)
      .single();
    const sec = secRow as Security;

    // Locked?
    if (sec.locked_forever) {
      await log("locked", userId);
      return jsonResponse({ error: "locked", forever: true }, 423);
    }
    if (sec.locked_until && new Date(sec.locked_until).getTime() > Date.now()) {
      await log("locked", userId);
      const minutes = Math.ceil((new Date(sec.locked_until).getTime() - Date.now()) / 60000);
      return jsonResponse({ error: "locked", forever: false, minutes }, 423);
    }

    // Verify credentials with an anon client (no persistence)
    const anon = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: signIn, error: signInError } = await anon.auth.signInWithPassword({ email, password });

    if (signInError || !signIn.session) {
      const attempts = (sec.failed_login_attempts || 0) + 1;
      const update: Record<string, unknown> = { failed_login_attempts: attempts, updated_at: new Date().toISOString() };
      if (policy.max_login_attempts !== null && attempts >= policy.max_login_attempts) {
        if (policy.lockout_minutes === null) {
          update.locked_forever = true;
        } else {
          update.locked_until = new Date(Date.now() + policy.lockout_minutes * 60000).toISOString();
        }
        update.failed_login_attempts = 0;
      }
      await service.from("user_security").update(update).eq("user_id", userId);
      await log("invalid_credentials", userId);
      return jsonResponse({ error: "invalid_credentials" }, 401);
    }

    // Success
    const nowIso = new Date().toISOString();
    await service.from("user_security").update({
      failed_login_attempts: 0,
      locked_until: null,
      locked_forever: false,
      last_login_at: nowIso,
      updated_at: nowIso,
    }).eq("user_id", userId);

    const loginId = await log("success", userId);

    let passwordExpired = false;
    if (policy.expiration_days !== null && sec.password_changed_at) {
      const ageMs = Date.now() - new Date(sec.password_changed_at).getTime();
      passwordExpired = ageMs > policy.expiration_days * 86400000;
    }

    // Retention housekeeping (12 months); failures are non-fatal
    try { await service.rpc("purge_security_logs"); } catch (e) { console.log("[secure-login] purge failed", e); }

    return jsonResponse({
      login_id: loginId,
      must_change_password: sec.must_change_password || passwordExpired,
      session: {
        access_token: signIn.session.access_token,
        refresh_token: signIn.session.refresh_token,
      },
    });
  } catch (e) {
    console.error("[secure-login] error", e);
    return jsonResponse({ error: "server_error" }, 500);
  }
});
