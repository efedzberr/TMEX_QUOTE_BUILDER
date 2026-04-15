import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getSecret(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    console.error(`SECRET MISSING: ${name} is not configured in Supabase secrets`);
  } else {
    console.log(`Secret ${name} loaded successfully (length: ${value.length})`);
  }
  return value || "";
}

interface EmailRequest {
  type: string;
  quoteId?: string;
  customerEmail?: string;
  customerName?: string;
  personalMessage?: string;
  testTo?: string;
}

interface QuoteRow {
  id: string;
  quote_number: string;
  generated_quote_name: string;
  partner_account: string;
  owner_name: string;
  mx_sales_rep: string;
  us_sales_rep: string;
  currency: string;
  type_of_service: string;
  review_token: string;
  token_expires_at: string;
  customer_review_status: string;
  customer_responded_at: string;
  customer_name: string;
  customer_title: string;
  customer_email: string;
  customer_signature_data: string;
  lane_acceptance: Record<string, { status: string; comment?: string; lane_ids: string[] }>;
  negotiation_quote_id: string;
}

interface LaneRow {
  id: string;
  origin_city: string;
  destination_city: string;
  us_rate: number;
  mx_rate: number;
  border_crossing_fee: number;
  toll_rate: number;
  accessorials_amount: number;
  trip_type: string;
  split_billing_group: string;
  is_primary_lane: boolean;
  paired_lane_id: string;
  sort_order: number;
  currency_code: string;
}

interface LaneGroup {
  label: string;
  origin: string;
  destination: string;
  total: number;
  currency: string;
  status?: string;
  comment?: string;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function formatCurrency(amount: number, currency: string): string {
  return `${currency} $${amount.toFixed(2)}`;
}

function buildLaneGroups(lanes: LaneRow[], acceptance?: QuoteRow["lane_acceptance"]): LaneGroup[] {
  const groups: LaneGroup[] = [];
  const processed = new Set<string>();
  const sorted = [...lanes].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  for (const lane of sorted) {
    if (processed.has(lane.id)) continue;
    const tripType = lane.trip_type || "One Way";
    const isSplit = !!lane.split_billing_group;
    const curr = lane.currency_code || "USD";

    let groupLanes: LaneRow[];
    let groupId: string;
    let label: string;

    if (isSplit) {
      groupLanes = sorted.filter((l) => l.split_billing_group === lane.split_billing_group);
      groupId = lane.split_billing_group;
      const nums = groupLanes.map((l) => sorted.indexOf(l) + 1);
      label = `Lanes ${Math.min(...nums)}-${Math.max(...nums)} - Split Billing`;
    } else if ((tripType === "Round Trip" || tripType === "Circuit") && lane.paired_lane_id) {
      const paired = sorted.find((l) => l.id === lane.paired_lane_id);
      const primary = lane.is_primary_lane ? lane : paired || lane;
      const secondary = lane.is_primary_lane ? paired : lane;
      groupLanes = secondary ? [primary, secondary] : [primary];
      groupId = primary.id;
      const nums = groupLanes.map((l) => sorted.indexOf(l) + 1);
      label = `Lanes ${Math.min(...nums)}-${Math.max(...nums)} - ${tripType}`;
    } else {
      groupLanes = [lane];
      groupId = lane.id;
      label = `Lane ${sorted.indexOf(lane) + 1}`;
    }

    groupLanes.forEach((l) => processed.add(l.id));

    const total = groupLanes.reduce(
      (sum, l) =>
        sum + (l.us_rate || 0) + (l.mx_rate || 0) + (l.border_crossing_fee || 0) + (l.toll_rate || 0) + (l.accessorials_amount || 0),
      0
    );

    const primary = groupLanes.find((l) => l.is_primary_lane) || groupLanes[0];

    let status: string | undefined;
    let comment: string | undefined;
    if (acceptance) {
      const key = `group_${groupId}`;
      const entry = acceptance[key] || acceptance[groupId];
      if (entry) {
        status = entry.status;
        comment = entry.comment;
      }
    }

    groups.push({
      label,
      origin: primary.origin_city || "",
      destination: primary.destination_city || "",
      total,
      currency: curr,
      status,
      comment,
    });
  }

  return groups;
}

function statusColor(status: string): { bg: string; border: string; text: string } {
  switch (status) {
    case "accepted":
      return { bg: "#F0FDF4", border: "#22C55E", text: "#15803D" };
    case "rejected":
      return { bg: "#FEF2F2", border: "#EF4444", text: "#B91C1C" };
    case "negotiate":
      return { bg: "#EFF6FF", border: "#3B82F6", text: "#1D4ED8" };
    default:
      return { bg: "#FFFBEB", border: "#F59E0B", text: "#92400E" };
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "accepted": return "Accepted";
    case "rejected": return "Rejected";
    case "negotiate": return "Negotiating";
    default: return "Mixed";
  }
}

function buildSendToCustomerHtml(
  quote: QuoteRow,
  groups: LaneGroup[],
  portalUrl: string,
  customerName?: string,
  personalMessage?: string
): string {
  const name = customerName || quote.customer_name || "Valued Customer";
  const expiryDate = formatDate(quote.token_expires_at);
  const sender = quote.mx_sales_rep || quote.owner_name;

  let personalBlock = "";
  if (personalMessage) {
    personalBlock = `
    <div style="background:#F3F4F6;border-left:4px solid #1E40AF;padding:12px 16px;margin:16px 0;border-radius:0 4px 4px 0;">
      <p style="margin:0;font-size:14px;color:#374151;font-style:italic;">"${personalMessage}"</p>
      <p style="margin:4px 0 0;font-size:12px;color:#6B7280;">— ${sender}</p>
    </div>`;
  }

  const laneRows = groups
    .map(
      (g) => `
      <tr style="border-bottom:1px solid #E5E7EB;">
        <td style="padding:8px;">${g.label}</td>
        <td style="padding:8px;">${g.origin}</td>
        <td style="padding:8px;">${g.destination}</td>
        <td style="padding:8px;text-align:right;font-weight:bold;">${formatCurrency(g.total, g.currency)}</td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#111827;">
  <div style="border-bottom:3px solid #1E40AF;padding-bottom:16px;margin-bottom:24px;">
    <h1 style="color:#1E40AF;font-size:20px;margin:0;">TransMex Smart Pricing Hub</h1>
    <p style="color:#6B7280;font-size:13px;margin:4px 0 0;">Quote Review Portal</p>
  </div>

  <p style="font-size:15px;">Dear ${name},</p>
  <p style="font-size:14px;color:#374151;">Please find your quote from TransMex ready for your review. You can access your personalized quote portal using the button below.</p>

  ${personalBlock}

  <div style="background:#EFF6FF;border-radius:8px;padding:16px;margin:20px 0;">
    <h2 style="color:#1E40AF;font-size:15px;margin:0 0 12px;">Quote Details</h2>
    <table style="width:100%;font-size:13px;color:#374151;">
      <tr><td style="padding:4px 0;color:#6B7280;width:140px;">Quote Number:</td><td style="font-weight:bold;">${quote.quote_number}</td></tr>
      <tr><td style="padding:4px 0;color:#6B7280;">Account:</td><td>${quote.partner_account}</td></tr>
      <tr><td style="padding:4px 0;color:#6B7280;">Equipment:</td><td>${quote.type_of_service}</td></tr>
      <tr><td style="padding:4px 0;color:#6B7280;">Currency:</td><td>${quote.currency}</td></tr>
      <tr><td style="padding:4px 0;color:#6B7280;">Valid Until:</td><td style="color:#DC2626;font-weight:bold;">${expiryDate}</td></tr>
    </table>
  </div>

  <p style="font-size:13px;color:#6B7280;">This quote includes ${groups.length} lane(s) for your review:</p>
  <table style="width:100%;font-size:12px;border-collapse:collapse;margin:8px 0;">
    <thead>
      <tr style="background:#1E40AF;">
        <th style="color:white;padding:8px;text-align:left;">Lane</th>
        <th style="color:white;padding:8px;text-align:left;">Origin</th>
        <th style="color:white;padding:8px;text-align:left;">Destination</th>
        <th style="color:white;padding:8px;text-align:right;">Lane Total</th>
      </tr>
    </thead>
    <tbody>${laneRows}</tbody>
  </table>

  <div style="text-align:center;margin:32px 0;">
    <a href="${portalUrl}" style="background:#1E40AF;color:white;padding:14px 32px;border-radius:6px;text-decoration:none;font-size:16px;font-weight:bold;display:inline-block;">Review Your Quote</a>
  </div>

  <p style="font-size:12px;color:#DC2626;text-align:center;">This link expires on ${expiryDate}. After this date the link will no longer be accessible.</p>

  <p style="font-size:11px;color:#9CA3AF;text-align:center;">If the button above does not work, copy and paste this link into your browser:<br/><span style="color:#1E40AF;word-break:break-all;">${portalUrl}</span></p>

  <div style="border-top:1px solid #E5E7EB;margin-top:32px;padding-top:16px;font-size:11px;color:#9CA3AF;text-align:center;">
    <p style="margin:0;">This email was sent by TransMex Smart Pricing Hub on behalf of ${sender}.</p>
    <p style="margin:4px 0 0;">If you did not expect this email, please contact your TransMex representative directly.</p>
    <p style="margin:8px 0 0;">&copy; TransMex INC., S.A. DE C.V.</p>
  </div>
</body>
</html>`;
}

function buildInternalNotificationHtml(
  quote: QuoteRow,
  groups: LaneGroup[],
  overallStatus: string,
  siteUrl: string
): string {
  const sc = statusColor(overallStatus);
  const label = statusLabel(overallStatus);

  const statusBanner = `
  <div style="background:${sc.bg};border-left:4px solid ${sc.border};padding:16px;margin:0 0 24px;border-radius:0 4px 4px 0;">
    <h2 style="color:${sc.text};font-size:18px;margin:0;">${label} — ${quote.quote_number}</h2>
    <p style="color:${sc.text};font-size:13px;margin:4px 0 0;">${quote.partner_account}</p>
  </div>`;

  const groupRows = groups
    .map((g) => {
      const gc = g.status ? statusColor(g.status) : statusColor("mixed");
      return `
      <tr style="border-bottom:1px solid #E5E7EB;">
        <td style="padding:8px;">${g.label}</td>
        <td style="padding:8px;">${g.origin} → ${g.destination}</td>
        <td style="padding:8px;background:${gc.bg};color:${gc.text};font-weight:bold;">${g.status ? statusLabel(g.status) : "—"}</td>
        <td style="padding:8px;font-size:11px;color:#6B7280;">${g.comment || "—"}</td>
      </tr>`;
    })
    .join("");

  const sigSection = quote.customer_signature_data
    ? `<div style="margin:20px 0;padding:16px;background:#F9FAFB;border-radius:8px;border:1px solid #E5E7EB;">
        <p style="font-size:12px;color:#6B7280;margin:0 0 8px;">Digital Signature Received:</p>
        <img src="${quote.customer_signature_data}" alt="Signature" style="max-height:60px;max-width:300px;"/>
        <p style="font-size:12px;color:#374151;margin:8px 0 0;">${quote.customer_name || ""} | ${quote.customer_title || ""} | ${formatDate(quote.customer_responded_at)}</p>
      </div>`
    : "";

  let actionSection = "";
  if (overallStatus === "accepted") {
    actionSection = `
    <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:16px;margin:20px 0;">
      <p style="color:#15803D;font-size:14px;margin:0;">No action required. The quote has been published.</p>
      <div style="margin-top:12px;">
        <a href="${siteUrl}" style="background:#1E40AF;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:bold;display:inline-block;">View Quote</a>
      </div>
    </div>`;
  } else {
    let revisionBtn = "";
    if (quote.negotiation_quote_id) {
      revisionBtn = `<a href="${siteUrl}" style="background:#F59E0B;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:bold;display:inline-block;margin-left:8px;">View Revision Quote</a>`;
    }
    actionSection = `
    <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;padding:16px;margin:20px 0;">
      <p style="color:#92400E;font-size:14px;font-weight:bold;margin:0;">Action Required</p>
      <p style="color:#92400E;font-size:13px;margin:4px 0 0;">Please review the customer's feedback and follow up.</p>
      <div style="margin-top:12px;">
        <a href="${siteUrl}" style="background:#1E40AF;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:bold;display:inline-block;">View Original Quote</a>
        ${revisionBtn}
      </div>
    </div>`;
  }

  return `<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#111827;">
  <div style="border-bottom:3px solid #1E40AF;padding-bottom:16px;margin-bottom:24px;">
    <h1 style="color:#1E40AF;font-size:20px;margin:0;">TransMex Smart Pricing Hub</h1>
    <p style="color:#6B7280;font-size:13px;margin:4px 0 0;">Customer Response Notification</p>
  </div>

  ${statusBanner}

  <div style="background:#F9FAFB;border-radius:8px;padding:16px;margin:0 0 20px;">
    <table style="width:100%;font-size:13px;color:#374151;">
      <tr><td style="padding:4px 0;color:#6B7280;width:130px;">Customer Name:</td><td style="font-weight:bold;">${quote.customer_name || "—"}</td></tr>
      <tr><td style="padding:4px 0;color:#6B7280;">Job Title:</td><td>${quote.customer_title || "—"}</td></tr>
      <tr><td style="padding:4px 0;color:#6B7280;">Response Date:</td><td>${formatDate(quote.customer_responded_at)}</td></tr>
      <tr><td style="padding:4px 0;color:#6B7280;">Quote Number:</td><td>${quote.quote_number}</td></tr>
    </table>
  </div>

  <table style="width:100%;font-size:12px;border-collapse:collapse;margin:8px 0;">
    <thead>
      <tr style="background:#1E40AF;">
        <th style="color:white;padding:8px;text-align:left;">Lane</th>
        <th style="color:white;padding:8px;text-align:left;">Route</th>
        <th style="color:white;padding:8px;text-align:left;">Status</th>
        <th style="color:white;padding:8px;text-align:left;">Comment</th>
      </tr>
    </thead>
    <tbody>${groupRows}</tbody>
  </table>

  ${sigSection}
  ${actionSection}

  <div style="border-top:1px solid #E5E7EB;margin-top:32px;padding-top:16px;font-size:11px;color:#9CA3AF;text-align:center;">
    <p style="margin:0;">This email was sent by TransMex Smart Pricing Hub.</p>
    <p style="margin:8px 0 0;">&copy; TransMex INC., S.A. DE C.V.</p>
  </div>
</body>
</html>`;
}

function buildCustomerConfirmationHtml(
  quote: QuoteRow,
  groups: LaneGroup[]
): string {
  const name = quote.customer_name || "Valued Customer";
  const tokenRef = (quote.review_token || "").substring(0, 8).toUpperCase();

  const groupRows = groups
    .map((g) => {
      const gc = g.status ? statusColor(g.status) : statusColor("mixed");
      return `
      <tr style="border-bottom:1px solid #E5E7EB;">
        <td style="padding:8px;">${g.label}</td>
        <td style="padding:8px;">${g.origin} → ${g.destination}</td>
        <td style="padding:8px;background:${gc.bg};color:${gc.text};font-weight:bold;">${g.status ? statusLabel(g.status) : "—"}</td>
        <td style="padding:8px;font-size:11px;color:#6B7280;">${g.comment || "—"}</td>
      </tr>`;
    })
    .join("");

  const sigSection = quote.customer_signature_data
    ? `<div style="margin:20px 0;padding:16px;background:#F9FAFB;border-radius:8px;border:1px solid #E5E7EB;">
        <p style="font-size:12px;color:#6B7280;margin:0 0 8px;">Your Digital Signature:</p>
        <img src="${quote.customer_signature_data}" alt="Signature" style="max-height:60px;max-width:300px;"/>
        <p style="font-size:12px;color:#374151;margin:8px 0 0;">${quote.customer_name || ""} | ${quote.customer_title || ""} | ${formatDate(quote.customer_responded_at)}</p>
      </div>`
    : "";

  const allAccepted = groups.every((g) => g.status === "accepted");
  const nextSteps = allAccepted
    ? `<p style="font-size:14px;color:#374151;">Your acceptance has been recorded. Your TransMex representative will contact you shortly to proceed.</p>`
    : `<p style="font-size:14px;color:#374151;">Your TransMex representative has been notified and will review your feedback. You can expect to hear from us within 1-2 business days.</p>`;

  const rep = quote.mx_sales_rep || quote.owner_name;

  return `<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#111827;">
  <div style="border-bottom:3px solid #1E40AF;padding-bottom:16px;margin-bottom:24px;">
    <h1 style="color:#1E40AF;font-size:20px;margin:0;">TransMex Smart Pricing Hub</h1>
    <p style="color:#6B7280;font-size:13px;margin:4px 0 0;">Quote Review Portal</p>
  </div>

  <h2 style="color:#1E40AF;font-size:18px;margin:0 0 16px;">Thank You — Response Received</h2>

  <p style="font-size:15px;">Dear ${name},</p>
  <p style="font-size:14px;color:#374151;">We have received your response to Quote ${quote.quote_number} from TransMex. Below is a summary of your selections for your records.</p>

  <table style="width:100%;font-size:12px;border-collapse:collapse;margin:20px 0;">
    <thead>
      <tr style="background:#1E40AF;">
        <th style="color:white;padding:8px;text-align:left;">Lane</th>
        <th style="color:white;padding:8px;text-align:left;">Route</th>
        <th style="color:white;padding:8px;text-align:left;">Your Decision</th>
        <th style="color:white;padding:8px;text-align:left;">Comment</th>
      </tr>
    </thead>
    <tbody>${groupRows}</tbody>
  </table>

  ${sigSection}

  <div style="background:#F3F4F6;border-radius:8px;padding:16px;margin:20px 0;">
    <table style="font-size:12px;color:#374151;">
      <tr><td style="padding:2px 8px 2px 0;color:#6B7280;">Submission Reference:</td><td style="font-weight:bold;">${tokenRef}</td></tr>
      <tr><td style="padding:2px 8px 2px 0;color:#6B7280;">Submitted:</td><td>${formatDate(quote.customer_responded_at)}</td></tr>
      <tr><td style="padding:2px 8px 2px 0;color:#6B7280;">Quote:</td><td>${quote.quote_number}</td></tr>
    </table>
    <p style="font-size:11px;color:#6B7280;margin:8px 0 0;">Please save this email for your records.</p>
  </div>

  <div style="margin:20px 0;">
    <h3 style="font-size:14px;color:#1E40AF;margin:0 0 8px;">Next Steps</h3>
    ${nextSteps}
  </div>

  <div style="margin:20px 0;">
    <p style="font-size:13px;color:#6B7280;margin:0;">If you have any questions please contact your TransMex representative:</p>
    <p style="font-size:14px;color:#374151;font-weight:bold;margin:4px 0 0;">${rep}</p>
  </div>

  <div style="border-top:1px solid #E5E7EB;margin-top:32px;padding-top:16px;font-size:11px;color:#9CA3AF;text-align:center;">
    <p style="margin:0;">This email was sent by TransMex Smart Pricing Hub on behalf of ${rep}.</p>
    <p style="margin:4px 0 0;">If you did not expect this email, please contact your TransMex representative directly.</p>
    <p style="margin:8px 0 0;">&copy; TransMex INC., S.A. DE C.V.</p>
  </div>
</body>
</html>`;
}

async function sendEmail(
  apiKey: string,
  from: string,
  to: string[],
  subject: string,
  html: string,
  cc?: string[]
): Promise<{ success: boolean; emailId?: string; error?: string; details?: unknown }> {
  try {
    const body: Record<string, unknown> = { from, to, subject, html };
    if (cc && cc.length > 0) body.cc = cc;

    console.log("Calling Resend API...", { from, to, subject: subject.substring(0, 60) });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const result = await res.json();

    console.log("Resend HTTP status:", res.status);
    console.log("Resend response body:", JSON.stringify(result));

    if (!res.ok) {
      console.error("Resend API error:", JSON.stringify(result));
      return { success: false, error: result.message || "Email delivery failed", details: result };
    }

    console.log("Email sent successfully, Resend ID:", result.id);
    return { success: true, emailId: result.id };
  } catch (err) {
    console.error("Email send error:", err);
    return { success: false, error: String(err) };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const payload: EmailRequest = await req.json();
    const { type } = payload;

    console.log("=== Edge function called ===", { type, method: req.method });

    if (type === "test_email") {
      const RESEND_API_KEY = getSecret("RESEND_API_KEY");
      const FROM_EMAIL = getSecret("RESEND_FROM_EMAIL");
      const testTo = payload.testTo;

      console.log("TEST EMAIL TRIGGERED");
      console.log("API Key exists:", !!RESEND_API_KEY);
      console.log("API Key prefix:", RESEND_API_KEY?.substring(0, 8));
      console.log("From email:", FROM_EMAIL);
      console.log("Test recipient:", testTo);

      if (!RESEND_API_KEY) {
        return jsonResponse({
          success: false,
          error: "RESEND_API_KEY secret is missing",
          config: { has_api_key: false, from_email: FROM_EMAIL },
        }, 500);
      }

      if (!testTo) {
        return jsonResponse({
          success: false,
          error: "testTo email address is required in the request body",
        }, 400);
      }

      const testPayload = {
        from: FROM_EMAIL || "onboarding@resend.dev",
        to: [testTo],
        subject: "TransMex Edge Function Test",
        html: "<h2>Edge Function Email Test</h2><p>This is a test email from the TransMex Smart Pricing Hub Edge Function.</p><p>If you received this, the Resend API integration is working correctly.</p>",
      };

      console.log("Sending test payload:", JSON.stringify(testPayload));

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(testPayload),
      });

      const result = await res.json();

      console.log("Resend HTTP status:", res.status);
      console.log("Resend response:", JSON.stringify(result));

      return jsonResponse({
        success: res.ok,
        status: res.status,
        resend_response: result,
        config: {
          has_api_key: !!RESEND_API_KEY,
          api_key_prefix: RESEND_API_KEY?.substring(0, 8),
          from_email: FROM_EMAIL || "onboarding@resend.dev",
        },
      });
    }

    if (type === "check_secrets") {
      const RESEND_API_KEY = getSecret("RESEND_API_KEY");
      const FROM_EMAIL = getSecret("RESEND_FROM_EMAIL");
      const SITE_URL = getSecret("SITE_URL");
      return jsonResponse({
        has_resend_key: !!RESEND_API_KEY,
        resend_key_prefix: RESEND_API_KEY?.substring(0, 8),
        has_from_email: !!FROM_EMAIL,
        from_email_value: FROM_EMAIL,
        has_site_url: !!SITE_URL,
        site_url_value: SITE_URL,
      });
    }

    const RESEND_API_KEY = getSecret("RESEND_API_KEY");
    const FROM_EMAIL = getSecret("RESEND_FROM_EMAIL");
    const SITE_URL = getSecret("SITE_URL");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!RESEND_API_KEY || !FROM_EMAIL) {
      return jsonResponse({
        error: "Email service not configured",
        details: { has_key: !!RESEND_API_KEY, has_from: !!FROM_EMAIL },
      }, 500);
    }

    const { quoteId, customerEmail, customerName, personalMessage } = payload;

    if (!quoteId) {
      return jsonResponse({ error: "Missing required field: quoteId" }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: quote, error: quoteErr } = await supabase
      .from("quotes")
      .select("*")
      .eq("id", quoteId)
      .maybeSingle();

    if (quoteErr || !quote) {
      console.error("Quote not found:", quoteId, quoteErr);
      return jsonResponse({ error: "Quote not found", details: quoteErr }, 404);
    }

    const { data: lanes } = await supabase
      .from("quote_lanes")
      .select("*")
      .eq("quote_id", quoteId)
      .order("sort_order", { ascending: true });

    const laneData = (lanes || []) as LaneRow[];
    const q = quote as QuoteRow;

    if (type === "send_to_customer") {
      const toEmail = customerEmail || q.customer_email;
      if (!toEmail) {
        return jsonResponse({ error: "No customer email provided" }, 400);
      }

      const portalUrl = SITE_URL
        ? `${SITE_URL}/#/review/${q.review_token}`
        : `https://placeholder.app/#/review/${q.review_token}`;

      const groups = buildLaneGroups(laneData);
      const subject = `Your Quote from TransMex — ${q.quote_number} — ${q.partner_account}`;
      const html = buildSendToCustomerHtml(q, groups, portalUrl, customerName, personalMessage);

      console.log("Sending email to:", toEmail, "from:", FROM_EMAIL, "portalUrl:", portalUrl);

      const result = await sendEmail(RESEND_API_KEY, FROM_EMAIL, [toEmail], subject, html);

      console.log("send_to_customer result:", JSON.stringify(result));

      return jsonResponse(result, result.success ? 200 : 500);
    }

    if (type === "response_received_internal") {
      const overallStatus = q.customer_review_status || "mixed";

      const subjectPrefixes: Record<string, string> = {
        accepted: "Quote Accepted",
        rejected: "Quote Rejected",
        negotiate: "Negotiation Requested",
        mixed: "Mixed Response",
      };
      const prefix = subjectPrefixes[overallStatus] || "Customer Response";
      const subject = `${prefix} — ${q.quote_number} — ${q.partner_account}`;

      const groups = buildLaneGroups(laneData, q.lane_acceptance);
      const html = buildInternalNotificationHtml(q, groups, overallStatus, SITE_URL || "");

      const toEmail = `${q.owner_name.toLowerCase().replace(/\s+/g, ".")}@transmex.com`;

      const result = await sendEmail(RESEND_API_KEY, FROM_EMAIL, [toEmail], subject, html);

      console.log("response_received_internal:", JSON.stringify(result));

      return jsonResponse(result, result.success ? 200 : 500);
    }

    if (type === "response_confirmation_customer") {
      const toEmail = customerEmail || q.customer_email;
      if (!toEmail) {
        return jsonResponse({ error: "No customer email provided" }, 400);
      }

      const subject = `Your Response Has Been Received — ${q.quote_number}`;
      const groups = buildLaneGroups(laneData, q.lane_acceptance);
      const html = buildCustomerConfirmationHtml(q, groups);

      const result = await sendEmail(RESEND_API_KEY, FROM_EMAIL, [toEmail], subject, html);

      console.log("response_confirmation_customer:", JSON.stringify(result));

      return jsonResponse(result, result.success ? 200 : 500);
    }

    return jsonResponse({ error: `Unknown email type: ${type}` }, 400);
  } catch (error) {
    console.error("Unhandled edge function error:", error);
    return jsonResponse({ error: "Internal server error", details: String(error) }, 500);
  }
});
