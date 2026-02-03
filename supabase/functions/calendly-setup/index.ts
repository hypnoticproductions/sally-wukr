import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const CALENDLY_ACCESS_TOKEN = Deno.env.get("CALENDLY_ACCESS_TOKEN");
const CALENDLY_API_BASE = "https://api.calendly.com";

async function getCurrentUser() {
  const response = await fetch(`${CALENDLY_API_BASE}/users/me`, {
    headers: {
      "Authorization": `Bearer ${CALENDLY_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get current user: ${response.status}`);
  }

  const data = await response.json();
  return data.resource;
}

async function createWebhookSubscription(organizationUri: string, webhookUrl: string) {
  const response = await fetch(`${CALENDLY_API_BASE}/webhook_subscriptions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${CALENDLY_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url: webhookUrl,
      events: ["invitee.created", "invitee.canceled"],
      organization: organizationUri,
      scope: "organization",
    }),
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Failed to create webhook: ${response.status} - ${errorData}`);
  }

  const data = await response.json();
  return data.resource;
}

async function listWebhookSubscriptions(organizationUri: string) {
  const response = await fetch(
    `${CALENDLY_API_BASE}/webhook_subscriptions?organization=${encodeURIComponent(organizationUri)}&scope=organization`,
    {
      headers: {
        "Authorization": `Bearer ${CALENDLY_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to list webhooks: ${response.status}`);
  }

  const data = await response.json();
  return data.collection || [];
}

async function deleteWebhookSubscription(webhookUri: string) {
  const response = await fetch(webhookUri, {
    method: "DELETE",
    headers: {
      "Authorization": `Bearer ${CALENDLY_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok && response.status !== 404) {
    throw new Error(`Failed to delete webhook: ${response.status}`);
  }

  return true;
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
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "setup";

    const user = await getCurrentUser();
    const organizationUri = user.current_organization;
    const webhookUrl = `${supabaseUrl}/functions/v1/calendly-webhook`;

    let result: any = {};

    if (action === "setup") {
      const existingWebhooks = await listWebhookSubscriptions(organizationUri);
      const matchingWebhook = existingWebhooks.find((w: any) => w.callback_url === webhookUrl);

      if (matchingWebhook) {
        result = {
          action: "existing",
          message: "Webhook subscription already exists",
          webhook: matchingWebhook,
        };
      } else {
        const webhook = await createWebhookSubscription(organizationUri, webhookUrl);
        result = {
          action: "created",
          message: "Webhook subscription created successfully",
          webhook: webhook,
        };
      }
    } else if (action === "list") {
      const webhooks = await listWebhookSubscriptions(organizationUri);
      result = {
        action: "list",
        webhooks: webhooks,
        organizationUri: organizationUri,
      };
    } else if (action === "info") {
      result = {
        action: "info",
        user: {
          uri: user.uri,
          name: user.name,
          email: user.email,
          current_organization: user.current_organization,
        },
        webhookUrl: webhookUrl,
      };
    }

    return new Response(
      JSON.stringify({ success: true, ...result }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error in Calendly setup:", error);

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
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
