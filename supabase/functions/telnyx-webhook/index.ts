import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  console.log("telnyx-webhook received request");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  let rawBody = "";

  try {
    rawBody = await req.text();
    console.log("Raw body received:", rawBody.substring(0, 500));
  } catch (e) {
    console.error("Failed to read body:", e);
    return new Response(
      JSON.stringify({ error: "Failed to read body", details: String(e) }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch (e) {
    console.error("Invalid JSON:", e);
    return new Response(
      JSON.stringify({ error: "Invalid JSON", details: String(e) }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const eventType = body?.data?.event_type || body?.event_type;
  const payload = body?.data?.payload || body?.payload || body?.data || body;
  const callControlId = payload?.call_control_id;
  const direction = payload?.direction;

  console.log("Event:", eventType, "Direction:", direction, "CallControlId:", callControlId);

  const TELNYX_API_KEY = Deno.env.get("TELNYX_API_KEY");
  console.log("API Key exists:", !!TELNYX_API_KEY);

  if (!TELNYX_API_KEY) {
    console.error("TELNYX_API_KEY not configured");
    return new Response(
      JSON.stringify({ error: "TELNYX_API_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (eventType === "call.initiated" && direction === "incoming") {
    console.log("Answering incoming call (fire-and-forget)");

    fetch(
      `https://api.telnyx.com/v2/calls/${callControlId}/actions/answer`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${TELNYX_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      }
    )
      .then((res) => res.text().then((text) => console.log("Answer API response:", res.status, text)))
      .catch((err) => console.error("Answer API error:", err));

    return new Response(
      JSON.stringify({ success: true, action: "answering" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (eventType === "call.answered") {
    console.log("Call answered, sending greeting (fire-and-forget)");

    fetch(
      `https://api.telnyx.com/v2/calls/${callControlId}/actions/speak`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${TELNYX_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          payload: "Hello! You've reached Sally with Dopa Buzz. How can I help you today?",
          voice: "female",
          language: "en-US",
        }),
      }
    )
      .then((res) => res.text().then((text) => console.log("Speak API response:", res.status, text)))
      .catch((err) => console.error("Speak API error:", err));

    return new Response(
      JSON.stringify({ success: true, action: "greeting" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      event_type: eventType,
      direction: direction,
      call_control_id: callControlId
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
