import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface HealthCheckResult {
  service: string;
  status: "healthy" | "degraded" | "down";
  responseTimeMs: number;
  details: Record<string, any>;
}

async function checkDatabase(supabase: any): Promise<HealthCheckResult> {
  const startTime = Date.now();
  try {
    const { data, error } = await supabase
      .from("clients")
      .select("id")
      .limit(1);

    const responseTimeMs = Date.now() - startTime;

    if (error) {
      return {
        service: "database",
        status: "down",
        responseTimeMs,
        details: { error: error.message },
      };
    }

    const status = responseTimeMs > 1000 ? "degraded" : "healthy";
    return {
      service: "database",
      status,
      responseTimeMs,
      details: { query: "select_clients" },
    };
  } catch (error) {
    return {
      service: "database",
      status: "down",
      responseTimeMs: Date.now() - startTime,
      details: { error: error instanceof Error ? error.message : "Unknown error" },
    };
  }
}

async function checkStripe(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");

  if (!stripeSecretKey) {
    return {
      service: "stripe",
      status: "down",
      responseTimeMs: 0,
      details: { error: "Stripe secret key not configured" },
    };
  }

  try {
    const response = await fetch("https://api.stripe.com/v1/balance", {
      headers: {
        "Authorization": `Bearer ${stripeSecretKey}`,
      },
    });

    const responseTimeMs = Date.now() - startTime;

    if (!response.ok) {
      return {
        service: "stripe",
        status: "down",
        responseTimeMs,
        details: { status: response.status, error: "API request failed" },
      };
    }

    const status = responseTimeMs > 2000 ? "degraded" : "healthy";
    return {
      service: "stripe",
      status,
      responseTimeMs,
      details: { endpoint: "balance" },
    };
  } catch (error) {
    return {
      service: "stripe",
      status: "down",
      responseTimeMs: Date.now() - startTime,
      details: { error: error instanceof Error ? error.message : "Unknown error" },
    };
  }
}

async function checkCalendly(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  const calendlyToken = Deno.env.get("CALENDLY_ACCESS_TOKEN");

  if (!calendlyToken) {
    return {
      service: "calendly",
      status: "down",
      responseTimeMs: 0,
      details: { error: "Calendly access token not configured" },
    };
  }

  try {
    const response = await fetch("https://api.calendly.com/users/me", {
      headers: {
        "Authorization": `Bearer ${calendlyToken}`,
        "Content-Type": "application/json",
      },
    });

    const responseTimeMs = Date.now() - startTime;

    if (!response.ok) {
      return {
        service: "calendly",
        status: "down",
        responseTimeMs,
        details: { status: response.status, error: "API request failed" },
      };
    }

    const status = responseTimeMs > 2000 ? "degraded" : "healthy";
    return {
      service: "calendly",
      status,
      responseTimeMs,
      details: { endpoint: "users/me" },
    };
  } catch (error) {
    return {
      service: "calendly",
      status: "down",
      responseTimeMs: Date.now() - startTime,
      details: { error: error instanceof Error ? error.message : "Unknown error" },
    };
  }
}

async function checkTelnyx(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  const telnyxApiKey = Deno.env.get("TELNYX_API_KEY");

  if (!telnyxApiKey) {
    return {
      service: "telnyx",
      status: "down",
      responseTimeMs: 0,
      details: { error: "Telnyx API key not configured" },
    };
  }

  try {
    const response = await fetch("https://api.telnyx.com/v2/balance", {
      headers: {
        "Authorization": `Bearer ${telnyxApiKey}`,
        "Content-Type": "application/json",
      },
    });

    const responseTimeMs = Date.now() - startTime;

    if (!response.ok) {
      return {
        service: "telnyx",
        status: "down",
        responseTimeMs,
        details: { status: response.status, error: "API request failed" },
      };
    }

    const status = responseTimeMs > 2000 ? "degraded" : "healthy";
    return {
      service: "telnyx",
      status,
      responseTimeMs,
      details: { endpoint: "balance" },
    };
  } catch (error) {
    return {
      service: "telnyx",
      status: "down",
      responseTimeMs: Date.now() - startTime,
      details: { error: error instanceof Error ? error.message : "Unknown error" },
    };
  }
}

async function getErrorStats(supabase: any) {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [recentErrors, dailyErrors, unresolvedErrors, webhookFailures] = await Promise.all([
    supabase
      .from("error_logs")
      .select("id", { count: "exact" })
      .gte("created_at", oneHourAgo),
    supabase
      .from("error_logs")
      .select("id", { count: "exact" })
      .gte("created_at", oneDayAgo),
    supabase
      .from("error_logs")
      .select("id", { count: "exact" })
      .eq("resolved", false),
    supabase
      .from("webhook_failures")
      .select("id", { count: "exact" })
      .in("status", ["pending", "retrying"]),
  ]);

  return {
    errorsLastHour: recentErrors.count || 0,
    errorsLast24Hours: dailyErrors.count || 0,
    unresolvedErrors: unresolvedErrors.count || 0,
    pendingWebhookRetries: webhookFailures.count || 0,
  };
}

async function checkAlertRules(supabase: any, errorStats: any) {
  const { data: rules } = await supabase
    .from("alert_rules")
    .select("*")
    .eq("enabled", true);

  if (!rules) return;

  for (const rule of rules) {
    const windowStart = new Date(Date.now() - rule.window_minutes * 60 * 1000).toISOString();

    const { count } = await supabase
      .from("error_logs")
      .select("id", { count: "exact" })
      .eq("error_type", rule.error_type)
      .gte("created_at", windowStart);

    if (count >= rule.threshold) {
      const cooldownExpired = !rule.last_triggered_at ||
        new Date(rule.last_triggered_at).getTime() < Date.now() - rule.cooldown_minutes * 60 * 1000;

      if (cooldownExpired) {
        const { data: recentErrors } = await supabase
          .from("error_logs")
          .select("id")
          .eq("error_type", rule.error_type)
          .gte("created_at", windowStart)
          .limit(10);

        await supabase.from("alert_notifications").insert({
          alert_rule_id: rule.id,
          error_log_ids: recentErrors?.map((e: any) => e.id) || [],
          channel: "dashboard",
          status: "sent",
          message: `Alert: ${rule.name} - ${count} ${rule.error_type} errors in the last ${rule.window_minutes} minutes`,
        });

        await supabase
          .from("alert_rules")
          .update({ last_triggered_at: new Date().toISOString() })
          .eq("id", rule.id);
      }
    }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const [databaseHealth, stripeHealth, calendlyHealth, telnyxHealth, errorStats] = await Promise.all([
      checkDatabase(supabase),
      checkStripe(),
      checkCalendly(),
      checkTelnyx(),
      getErrorStats(supabase),
    ]);

    const healthResults = [databaseHealth, stripeHealth, calendlyHealth, telnyxHealth];

    for (const result of healthResults) {
      await supabase.from("health_checks").insert({
        service: result.service,
        status: result.status,
        response_time_ms: result.responseTimeMs,
        details: result.details,
        checked_at: new Date().toISOString(),
      });

      if (result.status === "down") {
        await supabase.from("error_logs").insert({
          source: "system-health-check",
          error_type: "service_unavailable",
          severity: "critical",
          message: `${result.service} service is down`,
          context: result.details,
        });
      }
    }

    await checkAlertRules(supabase, errorStats);

    const overallStatus = healthResults.some(r => r.status === "down")
      ? "unhealthy"
      : healthResults.some(r => r.status === "degraded")
        ? "degraded"
        : "healthy";

    return new Response(
      JSON.stringify({
        status: overallStatus,
        timestamp: new Date().toISOString(),
        services: healthResults,
        errorStats,
      }),
      {
        status: overallStatus === "unhealthy" ? 503 : 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
