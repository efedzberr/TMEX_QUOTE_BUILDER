import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import bcrypt from "npm:bcryptjs@2.4.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

interface Policy {
  history_count: number;
  min_length: number;
  complexity: string;
  disallow_username: boolean;
}

function evaluate(password: string, policy: Policy, email: string): string[] {
  const failed: string[] = [];
  if (password.length < policy.min_length) failed.push("length");
  const hasAlpha = /[A-Za-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  switch (policy.complexity) {
    case "alpha_numeric":
      if (!hasAlpha) failed.push("alpha");
      if (!hasDigit) failed.push("digit");
      break;
    case "alpha_numeric_special":
      if (!hasAlpha) failed.push("alpha");
      if (!hasDigit) failed.push("digit");
      if (!hasSpecial) failed.push("special");
      break;
    case "upper_lower_numeric":
      if (!hasUpper) failed.push("upper");
      if (!hasLower) failed.push("lower");
      if (!hasDigit) failed.push("digit");
      break;
    case "upper_lower_numeric_special":
      if (!hasUpper) failed.push("upper");
      if (!hasLower) failed.push("lower");
      if (!hasDigit) failed.push("digit");
      if (!hasSpecial) failed.push("special");
      break;
  }
  if (policy.disallow_username) {
    const local = (email.split("@")[0] || "").toLowerCase();
    if (local.length >= 3 && password.toLowerCase().includes(local)) failed.push("username");
  }
  return failed;
}

function jwtAal(token: string): string {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return String(payload.aal || "aal1");
  } catch { return "aal1"; }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const service = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return jsonResponse({ error: "invalid_token" }, 401);
  const token = authHeader.slice(7);
  const { data: { user }, error: userErr } = await service.auth.getUser(token);
  if (userErr || !user || !user.email) return jsonResponse({ error: "invalid_token" }, 401);

  let newPassword = "";
  let currentPassword: string | null = null;
  try {
    const body = await req.json();
    newPassword = String(body.new_password || "");
    currentPassword = body.current_password ? String(body.current_password) : null;
  } catch {
    return jsonResponse({ error: "bad_request" }, 400);
  }
  if (!newPassword) return jsonResponse({ error: "bad_request", message: "New password required" }, 400);

  try {
    // A fully authenticated session (aal2) must prove the current password.
    // Invite / recovery sessions are aal1 and have no current password to prove.
    if (jwtAal(token) === "aal2") {
      if (!currentPassword) return jsonResponse({ error: "current_password_required", message: "Current password is required" }, 400);
      const anon = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
      const { error: verifyErr } = await anon.auth.signInWithPassword({ email: user.email, password: currentPassword });
      if (verifyErr) return jsonResponse({ error: "invalid_current_password", message: "Current password is incorrect" }, 400);
    }

    const { data: policyData } = await service.rpc("get_password_policy");
    const policy: Policy = { history_count: 3, min_length: 8, complexity: "alpha_numeric", disallow_username: true, ...((policyData as Partial<Policy>) || {}) };

    const failed = evaluate(newPassword, policy, user.email);
    if (failed.length > 0) return jsonResponse({ error: "policy_violation", message: "Password does not meet the policy", failed_rules: failed }, 422);

    if (policy.history_count > 0) {
      const { data: history } = await service
        .from("password_history")
        .select("password_hash")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(policy.history_count);
      for (const row of (history || []) as { password_hash: string }[]) {
        if (await bcrypt.compare(newPassword, row.password_hash)) {
          return jsonResponse({ error: "password_reused", message: `You cannot reuse any of your last ${policy.history_count} passwords`, failed_rules: ["history"] }, 422);
        }
      }
    }

    const { error: updErr } = await service.auth.admin.updateUserById(user.id, { password: newPassword });
    if (updErr) return jsonResponse({ error: "update_failed", message: updErr.message }, 500);

    const hash = await bcrypt.hash(newPassword, 10);
    await service.from("password_history").insert({ user_id: user.id, password_hash: hash });
    const nowIso = new Date().toISOString();
    await service.from("user_security").upsert(
      { user_id: user.id, password_changed_at: nowIso, must_change_password: false, updated_at: nowIso },
      { onConflict: "user_id" },
    );

    // Keep at most 24 hashes per user
    const { data: all } = await service.from("password_history").select("id").eq("user_id", user.id).order("created_at", { ascending: false });
    const ids = ((all || []) as { id: number }[]).map(r => r.id).slice(24);
    if (ids.length > 0) await service.from("password_history").delete().in("id", ids);

    const { data: profile } = await service.from("user_profiles").select("display_name").eq("id", user.id).maybeSingle();
    await service.rpc("activity_write", {
      p_user_id: user.id,
      p_user_name: (profile as { display_name: string | null } | null)?.display_name || user.email,
      p_event: "Password Changed", p_object: "user", p_record_id: user.id, p_record_label: user.email,
      p_details: null, p_session_id: null, p_source: "app",
    });

    return jsonResponse({ ok: true });
  } catch (e) {
    console.error("[change-password] error", e);
    return jsonResponse({ error: "server_error" }, 500);
  }
});
