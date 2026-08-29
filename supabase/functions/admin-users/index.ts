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
    .select("id, display_name, phone, is_admin, profile_id, role_id");

  const profileMap = new Map(
    (profiles || []).map((p: { id: string; display_name: string | null; phone: string | null; is_admin: boolean; profile_id: string | null; role_id: string | null }) => [p.id, p])
  );

  // For each user, check factors reliably via getUserById (listUsers may omit factors)
  const result = await Promise.all(users.map(async (u) => {
    const profile = profileMap.get(u.id);

    // First try factors from listUsers response
    let mfaFactors = u.factors || [];

    // If empty, fetch individually to get accurate factor data
    if (mfaFactors.length === 0) {
      try {
        const { data: { user: fullUser } } = await serviceClient.auth.admin.getUserById(u.id);
        if (fullUser?.factors) {
          mfaFactors = fullUser.factors;
        }
      } catch {
        // If individual fetch fails, proceed with empty factors
      }
    }

    const hasVerifiedTotp = mfaFactors.some(
      (f: { factor_type: string; status: string }) =>
        f.factor_type === "totp" && f.status === "verified"
    );

    return {
      id: u.id,
      email: u.email,
      display_name: profile?.display_name || null,
      phone: profile?.phone || null,
      is_admin: profile?.is_admin || false,
      profile_id: profile?.profile_id || null,
      role_id: profile?.role_id || null,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      banned_until: u.banned_until,
      mfa_enrolled: hasVerifiedTotp,
    };
  }));

  return jsonResponse({ users: result });
}

async function handleInvite(
  serviceClient: ReturnType<typeof createClient>,
  body: { email?: string; display_name?: string; phone?: string | null; is_admin?: boolean; profile_id?: string; role_id?: string }
) {
  const { email, display_name, phone, is_admin, profile_id, role_id } = body;

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return jsonResponse({ error: "A valid email is required" }, 400);
  }
  if (!profile_id || typeof profile_id !== "string") {
    return jsonResponse({ error: "A profile is required" }, 400);
  }
  const { data: profileRow } = await serviceClient.from("profiles").select("id").eq("id", profile_id).maybeSingle();
  if (!profileRow) {
    return jsonResponse({ error: "The selected profile does not exist" }, 400);
  }
  if (role_id) {
    const { data: roleRow } = await serviceClient.from("roles").select("id").eq("id", role_id).maybeSingle();
    if (!roleRow) {
      return jsonResponse({ error: "The selected role does not exist" }, 400);
    }
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
        phone: phone || null,
        is_admin: is_admin === true,
        profile_id,
        role_id: role_id || null,
      },
      { onConflict: "id" }
    );

  if (profileErr) {
    return jsonResponse({ error: "User created but profile save failed" }, 500);
  }

  // Mirror display_name and phone into auth.users.raw_user_meta_data
  const metaPatch: Record<string, unknown> = {};
  if (display_name) metaPatch.display_name = display_name;
  if (phone) metaPatch.phone = phone;
  if (Object.keys(metaPatch).length > 0) {
    await serviceClient.auth.admin.updateUserById(userId, { user_metadata: metaPatch });
  }

  return jsonResponse({
    user: {
      id: userId,
      email,
      display_name: display_name || null,
      phone: phone || null,
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

async function handleUpdateUser(
  serviceClient: ReturnType<typeof createClient>,
  callerId: string,
  body: { user_id?: string; email?: string; display_name?: string; phone?: string | null; is_admin?: boolean; profile_id?: string | null; role_id?: string | null; active?: boolean }
) {
  const { user_id, email, display_name, phone, is_admin, profile_id, role_id, active } = body;

  if (!user_id || typeof user_id !== "string") {
    return jsonResponse({ error: "user_id is required" }, 400);
  }
  const { data: { user }, error: userErr } = await serviceClient.auth.admin.getUserById(user_id);
  if (userErr || !user) {
    return jsonResponse({ error: "Target user not found" }, 404);
  }
  if (user_id === callerId && (typeof is_admin === "boolean" && is_admin === false)) {
    return jsonResponse({ error: "Cannot remove your own admin access" }, 400);
  }
  if (user_id === callerId && active === false) {
    return jsonResponse({ error: "Cannot deactivate your own account" }, 400);
  }
  if (typeof display_name === "string" && !display_name.trim()) {
    return jsonResponse({ error: "Display name is required" }, 400);
  }
  if (typeof email === "string" && (!email.trim() || !email.includes("@"))) {
    return jsonResponse({ error: "A valid email is required" }, 400);
  }
  if (typeof profile_id === "string" && profile_id) {
    const { data: profileRow } = await serviceClient.from("profiles").select("id").eq("id", profile_id).maybeSingle();
    if (!profileRow) return jsonResponse({ error: "The selected profile does not exist" }, 400);
  }
  if (typeof role_id === "string" && role_id) {
    const { data: roleRow } = await serviceClient.from("roles").select("id").eq("id", role_id).maybeSingle();
    if (!roleRow) return jsonResponse({ error: "The selected role does not exist" }, 400);
  }

  // Auth-level changes (email, active)
  const authUpdate: Record<string, unknown> = {};
  if (typeof email === "string" && email.trim().toLowerCase() !== (user.email || "").toLowerCase()) {
    authUpdate.email = email.trim();
    authUpdate.email_confirm = true;
  }
  if (typeof active === "boolean") {
    authUpdate.ban_duration = active ? "none" : "876600h";
  }
  if (Object.keys(authUpdate).length > 0) {
    const { error: authErr } = await serviceClient.auth.admin.updateUserById(user_id, authUpdate);
    if (authErr) {
      const msg = authErr.message || "";
      return jsonResponse({ error: msg.includes("already") ? "A user with this email already exists" : (msg || "Failed to update user") }, 400);
    }
  }

  // Profile-level changes
  const profileUpdate: Record<string, unknown> = { id: user_id };
  if (typeof display_name === "string") profileUpdate.display_name = display_name.trim();
  if (phone !== undefined) profileUpdate.phone = phone || null;
  if (typeof is_admin === "boolean") profileUpdate.is_admin = is_admin;
  if (profile_id !== undefined) profileUpdate.profile_id = profile_id || null;
  if (role_id !== undefined) profileUpdate.role_id = role_id || null;
  if (Object.keys(profileUpdate).length > 1) {
    const { error: profileErr } = await serviceClient.from("user_profiles").upsert(profileUpdate, { onConflict: "id" });
    if (profileErr) {
      return jsonResponse({ error: "Failed to update user profile" }, 500);
    }
  }

  // Mirror display_name and phone into auth.users.raw_user_meta_data
  const metaPatch: Record<string, unknown> = {};
  if (typeof display_name === "string") metaPatch.display_name = display_name.trim();
  if (phone !== undefined) metaPatch.phone = phone || null;
  if (Object.keys(metaPatch).length > 0) {
    await serviceClient.auth.admin.updateUserById(user_id, { user_metadata: metaPatch });
  }

  return jsonResponse({ success: true, user_id });
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

async function handleDelete(
  serviceClient: ReturnType<typeof createClient>,
  callerId: string,
  body: { user_id?: string }
) {
  const { user_id } = body;

  if (!user_id || typeof user_id !== "string") {
    return jsonResponse({ error: "user_id is required" }, 400);
  }
  if (user_id === callerId) {
    return jsonResponse({ error: "Cannot delete your own account" }, 400);
  }

  // Delete auth user (cascades to user_profiles if FK is set, otherwise delete profile manually)
  const { error: deleteErr } = await serviceClient.auth.admin.deleteUser(user_id);
  if (deleteErr) {
    if (deleteErr.message?.includes("not found")) {
      return jsonResponse({ error: "Target user not found" }, 404);
    }
    return jsonResponse({ error: deleteErr.message || "Failed to delete user" }, 500);
  }

  // Also remove user_profiles row (in case there's no cascade)
  await serviceClient.from("user_profiles").delete().eq("id", user_id);

  return jsonResponse({ success: true, user_id });
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
      case "update_user":
        return await handleUpdateUser(serviceClient, callerId, body);
      case "reset_mfa":
        return await handleResetMfa(serviceClient, body);
      case "delete":
        return await handleDelete(serviceClient, callerId, body);
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
