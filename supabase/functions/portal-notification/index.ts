import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface GroupSummary {
  label: string;
  origin: string;
  destination: string;
  status: string;
  comment: string;
}

interface NotificationPayload {
  quote_number: string;
  partner_account: string;
  owner_name: string;
  overall_status: string;
  customer_name: string;
  groups: GroupSummary[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const payload: NotificationPayload = await req.json();

    const statusLabel =
      payload.overall_status === "accepted"
        ? "Fully Accepted"
        : payload.overall_status === "rejected"
          ? "Fully Rejected"
          : payload.overall_status === "negotiate"
            ? "Negotiation Requested"
            : "Mixed Response";

    const logEntry = {
      quote: payload.quote_number,
      account: payload.partner_account,
      customer: payload.customer_name,
      status: statusLabel,
      groups: payload.groups.length,
      timestamp: new Date().toISOString(),
    };

    console.log("Portal notification received:", JSON.stringify(logEntry));

    return new Response(
      JSON.stringify({
        success: true,
        message: `Notification logged for ${payload.quote_number}`,
        status: statusLabel,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error("Error processing notification:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Failed to process notification" }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});
