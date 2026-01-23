import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: "Supabase configuration missing" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const now = new Date().toISOString();

    const { data: clientsDue, error: queryError } = await supabase
      .from("clients")
      .select("id, name, phone_number, email, next_follow_up, call_preferences")
      .eq("payment_status", "paid")
      .not("phone_number", "is", null)
      .lte("next_follow_up", now)
      .order("next_follow_up", { ascending: true })
      .limit(10);

    if (queryError) {
      console.error("Query error:", queryError);
      return new Response(
        JSON.stringify({ error: "Failed to query clients", details: queryError }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!clientsDue || clientsDue.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No clients due for follow-up", calls_made: 0 }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const results = [];

    for (const client of clientsDue) {
      if (client.call_preferences?.do_not_call) {
        console.log(`Skipping ${client.name} - on do-not-call list`);
        continue;
      }

      const { data: recentAttempts } = await supabase
        .from("call_attempts")
        .select("attempt_number")
        .eq("client_id", client.id)
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order("attempt_number", { ascending: false })
        .limit(1);

      const attemptNumber = recentAttempts && recentAttempts.length > 0
        ? recentAttempts[0].attempt_number + 1
        : 1;

      if (attemptNumber > 3) {
        console.log(`Skipping ${client.name} - exceeded maximum retry attempts`);

        await supabase
          .from("clients")
          .update({
            next_follow_up: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
          })
          .eq("id", client.id);

        continue;
      }

      const quintapooUrl = `${SUPABASE_URL}/functions/v1/quintapoo-query`;
      let clientContext = "";

      try {
        const quintapooResponse = await fetch(quintapooUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: `What recent deliverables and tasks have been completed for ${client.name}?`,
            client_id: client.id,
          }),
        });

        if (quintapooResponse.ok) {
          const quintapooData = await quintapooResponse.json();
          clientContext = quintapooData.context || "";
        }
      } catch (e) {
        console.error("Failed to query Quintapoo:", e);
      }

      const callUrl = `${SUPABASE_URL}/functions/v1/telnyx-call`;
      const callResponse = await fetch(callUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: client.id,
        }),
      });

      if (callResponse.ok) {
        const callData = await callResponse.json();
        results.push({
          client_name: client.name,
          success: true,
          call_id: callData.call_id,
          attempt: attemptNumber,
        });

        await supabase
          .from("clients")
          .update({
            next_follow_up: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
          })
          .eq("id", client.id);

        console.log(`Called ${client.name} (attempt ${attemptNumber})`);
      } else {
        const errorData = await callResponse.text();
        results.push({
          client_name: client.name,
          success: false,
          error: errorData,
        });
        console.error(`Failed to call ${client.name}:`, errorData);
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${clientsDue.length} clients`,
        calls_made: results.filter(r => r.success).length,
        results: results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in scheduled-calls:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
