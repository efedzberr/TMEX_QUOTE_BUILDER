import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function verifyAdmin(
  serviceClient: ReturnType<typeof createClient>,
  authHeader: string | null
): Promise<{ callerId: string } | Response> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.log("[admin-users] REJECT: missing/invalid Authorization header");
    return jsonResponse({ error: "invalid_token", message: "Missing or invalid Authorization header" }, 403);
  }

  const token = authHeader.replace("Bearer ", "");

  // Resolve caller identity via service client (trusted verification)
  const { data: { user }, error: userErr } = await serviceClient.auth.getUser(token);
  if (userErr || !user) {
    console.log("[admin-users] REJECT: invalid token -", userErr?.message || "no user");
    return jsonResponse({ error: "invalid_token", message: "Invalid or expired token" }, 403);
  }

  const callerId = user.id;

  // Check is_admin in user_profiles
  const { data: profile, error: profileErr } = await serviceClient
    .from("user_profiles")
    .select("is_admin")
    .eq("id", callerId)
    .maybeSingle();

  const isAdmin = profile?.is_admin === true;
  if (profileErr || !isAdmin) {
    console.log(`[admin-users] REJECT: not_admin | user=${callerId} | profile_found=${!!profile} | is_admin=${profile?.is_admin}`);
    return jsonResponse({ error: "not_admin", message: "Admin access required" }, 403);
  }

  // Determine AAL by decoding the JWT payload claims directly
  let payloadAal = "unknown";
  let amrHasTotp = false;

  try {
    const parts = token.split(".");
    if (parts.length === 3) {
      const payloadB64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      const payloadJson = atob(payloadB64);
      const payload = JSON.parse(payloadJson);
      payloadAal = payload.aal || "unknown";
      if (Array.isArray(payload.amr)) {
        amrHasTotp = payload.amr.some((e: { method?: string }) => e.method === "totp" || e.method === "mfa");
      }
    }
  } catch {
    // If decode fails, leave as unknown
  }

  const isAal2 = payloadAal === "aal2" || amrHasTotp;

  if (!isAal2) {
    console.log(`[admin-users] REJECT: aal2_required | user=${callerId} | is_admin=true | payload.aal=${payloadAal} | amr_has_totp=${amrHasTotp}`);
    return jsonResponse({ error: "aal2_required", message: "MFA (AAL2) required" }, 403);
  }

  console.log(`[admin-users] PASS | user=${callerId} | is_admin=true | payload.aal=${payloadAal} | amr_has_totp=${amrHasTotp}`);
  return { callerId };
}

// --- Action handlers ---

async function handleList(serviceClient: ReturnType<typeof createClient>) {
  // Get all auth users
  const { data: { users }, error: usersErr } = await serviceClient.auth.admin.listUsers();
  if (usersErr) {
    return jsonResponse({ error: "Failed to list users" }, 500);
  }

  // Get all profiles
  const { data: profiles } = await serviceClient
    .from("user_profiles")
    .select("id, display_name, is_admin");

  const profileMap = new Map(
    (profiles || []).map((p: { id: string; display_name: string | null; is_admin: boolean }) => [p.id, p])
  );

  const result = users.map((u) => {
    const profile = profileMap.get(u.id);
    const mfaFactors = u.factors || [];
    const hasVerifiedTotp = mfaFactors.some(
      (f: { factor_type: string; status: string }) =>
        f.factor_type === "totp" && f.status === "verified"
    );

    return {
      id: u.id,
      email: u.email,
      display_name: profile?.display_name || null,
      is_admin: profile?.is_admin || false,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      banned_until: u.banned_until,
      mfa_enrolled: hasVerifiedTotp,
    };
  });

  return jsonResponse({ users: result });
}

async function handleInvite(
  serviceClient: ReturnType<typeof createClient>,
  body: { email?: string; display_name?: string; is_admin?: boolean }
) {
  const { email, display_name, is_admin } = body;

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return jsonResponse({ error: "A valid email is required" }, 400);
  }

  // Invite user (generates invite email)
  const { data: inviteData, error: inviteErr } =
    await serviceClient.auth.admin.inviteUserByEmail(email);

  if (inviteErr) {
    // If user already exists, that's okay for idempotency
    if (inviteErr.message?.includes("already been registered")) {
      return jsonResponse(
        { error: "A user with this email already exists" },
        400
      );
    }
    return jsonResponse({ error: inviteErr.message || "Failed to invite user" }, 500);
  }

  const userId = inviteData.user.id;

  // Upsert user_profiles row
  const { error: profileErr } = await serviceClient
    .from("user_profiles")
    .upsert(
      {
        id: userId,
        display_name: display_name || null,
        is_admin: is_admin === true,
      },
      { onConflict: "id" }
    );

  if (profileErr) {
    return jsonResponse({ error: "User created but profile save failed" }, 500);
  }

  return jsonResponse({
    user: {
      id: userId,
      email,
      display_name: display_name || null,
      is_admin: is_admin === true,
    },
  });
}

async function handleSetAdmin(
  serviceClient: ReturnType<typeof createClient>,
  callerId: string,
  body: { user_id?: string; is_admin?: boolean }
) {
  const { user_id, is_admin } = body;

  if (!user_id || typeof user_id !== "string") {
    return jsonResponse({ error: "user_id is required" }, 400);
  }
  if (typeof is_admin !== "boolean") {
    return jsonResponse({ error: "is_admin (boolean) is required" }, 400);
  }
  if (user_id === callerId) {
    return jsonResponse({ error: "Cannot change your own admin status" }, 400);
  }

  // Verify target exists
  const { data: { user }, error: userErr } =
    await serviceClient.auth.admin.getUserById(user_id);
  if (userErr || !user) {
    return jsonResponse({ error: "Target user not found" }, 404);
  }

  // Upsert profile
  const { error: profileErr } = await serviceClient
    .from("user_profiles")
    .upsert({ id: user_id, is_admin }, { onConflict: "id" });

  if (profileErr) {
    return jsonResponse({ error: "Failed to update admin status" }, 500);
  }

  return jsonResponse({ success: true, user_id, is_admin });
}

async function handleSetActive(
  serviceClient: ReturnType<typeof createClient>,
  callerId: string,
  body: { user_id?: string; active?: boolean }
) {
  const { user_id, active } = body;

  if (!user_id || typeof user_id !== "string") {
    return jsonResponse({ error: "user_id is required" }, 400);
  }
  if (typeof active !== "boolean") {
    return jsonResponse({ error: "active (boolean) is required" }, 400);
  }
  if (user_id === callerId) {
    return jsonResponse({ error: "Cannot deactivate your own account" }, 400);
  }

  // Ban or un-ban
  const banData = active
    ? { ban_duration: "none" }
    : { ban_duration: "876600h" }; // ~100 years

  const { error: updateErr } = await serviceClient.auth.admin.updateUserById(
    user_id,
    banData
  );

  if (updateErr) {
    if (updateErr.message?.includes("not found")) {
      return jsonResponse({ error: "Target user not found" }, 404);
    }
    return jsonResponse({ error: "Failed to update user status" }, 500);
  }

  return jsonResponse({ success: true, user_id, active });
}

async function handleResetMfa(
  serviceClient: ReturnType<typeof createClient>,
  body: { user_id?: string }
) {
  const { user_id } = body;

  if (!user_id || typeof user_id !== "string") {
    return jsonResponse({ error: "user_id is required" }, 400);
  }

  // Get the user's factors
  const { data: { user }, error: userErr } =
    await serviceClient.auth.admin.getUserById(user_id);

  if (userErr || !user) {
    return jsonResponse({ error: "Target user not found" }, 404);
  }

  const factors = user.factors || [];
  let unenrolledCount = 0;

  for (const factor of factors) {
    const { error: delErr } =
      await serviceClient.auth.admin.mfa.deleteFactor({
        userId: user_id,
        factorId: factor.id,
      });
    if (!delErr) unenrolledCount++;
  }

  return jsonResponse({
    success: true,
    user_id,
    factors_removed: unenrolledCount,
  });
}

// --- Main handler ---

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify caller is admin with AAL2
    const authHeader = req.headers.get("Authorization");
    const verification = await verifyAdmin(serviceClient, authHeader);
    if (verification instanceof Response) return verification;

    const { callerId } = verification;

    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "list":
        return await handleList(serviceClient);
      case "invite":
        return await handleInvite(serviceClient, body);
      case "set_admin":
        return await handleSetAdmin(serviceClient, callerId, body);
      case "set_active":
        return await handleSetActive(serviceClient, callerId, body);
      case "reset_mfa":
        return await handleResetMfa(serviceClient, body);
      default:
        return jsonResponse({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    return jsonResponse(
      { error: "Internal server error" },
      500
    );
  }
});
