import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  try {
    console.log("telnyx-webhook: Request received, method:", req.method);

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    const TELNYX_API_KEY = Deno.env.get("TELNYX_API_KEY");
    console.log("telnyx-webhook: TELNYX_API_KEY exists:", !!TELNYX_API_KEY);

    let rawBody: string;
    try {
      rawBody = await req.text();
      console.log("telnyx-webhook: Raw body length:", rawBody.length);
    } catch (e) {
      console.error("telnyx-webhook: Failed to read body:", e);
      return new Response(
        JSON.stringify({ received: true, error: "body_read_failed" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody);
      console.log("telnyx-webhook: Parsed body keys:", Object.keys(body));
    } catch (e) {
      console.error("telnyx-webhook: JSON parse failed:", e);
      return new Response(
        JSON.stringify({ received: true, error: "json_parse_failed" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const eventData = body.data as Record<string, unknown> || body;
    const eventType = eventData.event_type as string || body.event_type as string;
    const payload = eventData.payload as Record<string, unknown> || eventData;
    const callControlId = (payload.call_control_id || eventData.call_control_id) as string;
    const direction = (payload.direction || eventData.direction) as string;

    console.log("telnyx-webhook: Event:", eventType, "Direction:", direction, "CallControlId:", callControlId?.substring(0, 20));

    if (!TELNYX_API_KEY) {
      console.error("telnyx-webhook: No API key");
      return new Response(
        JSON.stringify({ received: true, error: "no_api_key" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (eventType === "call.initiated" && direction === "incoming" && callControlId) {
      console.log("telnyx-webhook: Attempting to answer call");

      const answerUrl = `https://api.telnyx.com/v2/calls/${callControlId}/actions/answer`;
      console.log("telnyx-webhook: Answer URL:", answerUrl);

      fetch(answerUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${TELNYX_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      })
        .then(async (res) => {
          const text = await res.text();
          console.log("telnyx-webhook: Answer response:", res.status, text.substring(0, 200));
        })
        .catch((err) => {
          console.error("telnyx-webhook: Answer fetch error:", err);
        });

      return new Response(
        JSON.stringify({ received: true, action: "answering", call_control_id: callControlId }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (eventType === "call.answered" && callControlId) {
      console.log("telnyx-webhook: Call answered, sending greeting");

      fetch(`https://api.telnyx.com/v2/calls/${callControlId}/actions/speak`, {
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
      })
        .then(async (res) => {
          const text = await res.text();
          console.log("telnyx-webhook: Speak response:", res.status, text.substring(0, 200));
        })
        .catch((err) => {
          console.error("telnyx-webhook: Speak fetch error:", err);
        });

      return new Response(
        JSON.stringify({ received: true, action: "greeting" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("telnyx-webhook: Event acknowledged:", eventType);
    return new Response(
      JSON.stringify({ received: true, event_type: eventType }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("telnyx-webhook: Top-level error:", error);
    return new Response(
      JSON.stringify({ received: true, error: "internal_error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
