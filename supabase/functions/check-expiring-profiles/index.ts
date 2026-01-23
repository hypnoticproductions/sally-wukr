import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.47.10";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase configuration missing");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date().toISOString();

    const { data: expiredClients, error: fetchError } = await supabase
      .from("clients")
      .select("*")
      .eq("payment_status", "paid")
      .lt("profile_expires_at", now);

    if (fetchError) {
      console.error("Error fetching expired clients:", fetchError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch expired clients" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!expiredClients || expiredClients.length === 0) {
      return new Response(
        JSON.stringify({
          message: "No expired profiles found",
          expired: 0,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const clientIds = expiredClients.map((c: any) => c.id);

    const { error: updateError } = await supabase
      .from("clients")
      .update({ payment_status: "expired" })
      .in("id", clientIds);

    if (updateError) {
      console.error("Error updating expired clients:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update expired clients" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const fiveDaysFromNow = new Date();
    fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);

    const { data: expiringClients, error: expiringError } = await supabase
      .from("clients")
      .select("*")
      .eq("payment_status", "paid")
      .lt("profile_expires_at", fiveDaysFromNow.toISOString())
      .gte("profile_expires_at", now);

    const expiringCount = expiringClients?.length || 0;

    console.log(`Updated ${expiredClients.length} expired profiles`);
    console.log(`Found ${expiringCount} profiles expiring within 5 days`);

    return new Response(
      JSON.stringify({
        message: "Profile expiration check completed",
        expired: expiredClients.length,
        expiringSoon: expiringCount,
        expiredClients: expiredClients.map((c: any) => ({
          id: c.id,
          name: c.name,
          email: c.email,
          expired_at: c.profile_expires_at,
        })),
        expiringClients: expiringClients?.map((c: any) => ({
          id: c.id,
          name: c.name,
          email: c.email,
          expires_at: c.profile_expires_at,
        })) || [],
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Expiration check error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to check expiring profiles" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
