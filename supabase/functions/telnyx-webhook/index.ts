import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  let rawBody = "";

  try {
    rawBody = await req.text();
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Failed to read body", details: String(e) }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Invalid JSON", details: String(e) }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const eventType = body?.data?.event_type || body?.event_type;
  const payload = body?.data?.payload || body?.payload || body?.data || body;
  const callControlId = payload?.call_control_id;
  const direction = payload?.direction;

  if (eventType === "call.initiated" && direction === "incoming") {
    const TELNYX_API_KEY = Deno.env.get("TELNYX_API_KEY");

    if (!TELNYX_API_KEY) {
      return new Response(
        JSON.stringify({ error: "TELNYX_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    try {
      const answerResponse = await fetch(
        `https://api.telnyx.com/v2/calls/${callControlId}/actions/answer`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${TELNYX_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        }
      );

      const answerText = await answerResponse.text();

      return new Response(
        JSON.stringify({
          success: true,
          action: "answered",
          status: answerResponse.status,
          response: answerText
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (fetchError) {
      return new Response(
        JSON.stringify({ error: "Answer call failed", details: String(fetchError) }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  if (eventType === "call.answered") {
    const TELNYX_API_KEY = Deno.env.get("TELNYX_API_KEY");

    if (!TELNYX_API_KEY) {
      return new Response(
        JSON.stringify({ error: "TELNYX_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    try {
      const speakResponse = await fetch(
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
      );

      const speakText = await speakResponse.text();

      return new Response(
        JSON.stringify({
          success: true,
          action: "greeting",
          status: speakResponse.status,
          response: speakText
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (fetchError) {
      return new Response(
        JSON.stringify({ error: "Speak failed", details: String(fetchError) }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      event_type: eventType,
      direction: direction,
      call_control_id: callControlId
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
