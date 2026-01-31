import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17.5.0";

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
    // Allow passing live key in request body, otherwise use env secret
    const { stripeSecretKey: providedKey } = await req.json().catch(() => ({}));
    const stripeSecretKey = providedKey || Deno.env.get("STRIPE_SECRET_KEY");

    if (!stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY not configured");
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2024-12-18.acacia",
    });

    // Create the 30-Day Strategic Profile Retention product
    const product = await stripe.products.create({
      name: "30-Day Strategic Profile Retention",
      description: "Keep your strategic profile active for 30 days with priority access to Richard D. Fortune. Complete profile retention, priority routing, and seamless continuation of conversations.",
      metadata: {
        service_type: "profile_retention",
        duration_days: "30",
      },
    });

    // Create a price for this product
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: 3000, // $30.00
      currency: "usd",
      metadata: {
        duration_days: "30",
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        product: {
          id: product.id,
          name: product.name,
          description: product.description,
        },
        price: {
          id: price.id,
          amount: price.unit_amount,
          currency: price.currency,
        },
        message: "Product and price created successfully!",
        instructions: `Add this to your Supabase secrets:\nSTRIPE_PRICE_ID=${price.id}`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Stripe product setup error:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Failed to create Stripe products",
        details: error.toString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
