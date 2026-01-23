# Sally Webhook Integration Guide

## Overview

The Sally Webhook endpoint enables **bidirectional integration** between Manus and Sally. While Sally automatically sends client data to Manus after payments, this webhook allows Manus to send signals back to Sally for task updates, scheduled actions, and automated workflows.

---

## Webhook URL

**Production Endpoint:**
```
https://gvqhpyzczswpcdnqkppp.supabase.co/functions/v1/sally-webhook
```

- **Method:** POST
- **Content-Type:** application/json
- **Authentication:** None required (optional X-Manus-Signature header for verification)
- **CORS:** Enabled for all origins

---

## Use Cases

### 1. Task Completion Tracking
When Richard completes a Manus task related to a Sally client, automatically update the client record in Sally's database.

### 2. Scheduled Follow-ups
When Manus schedules a follow-up meeting or call, sync the scheduled time back to Sally so it appears in the admin dashboard.

### 3. Action Triggers
Manus can trigger specific actions in Sally, such as:
- Flagging a client for urgent follow-up
- Marking a client as contacted
- Setting reminder timestamps

### 4. Expiration Reminders
3 days before a client's profile expires, Manus can notify Sally to flag the client for renewal outreach.

---

## Event Types

### `task.completed`

**When to Use:** When a Manus task is marked as complete

**Payload:**
```json
{
  "event": "task.completed",
  "task_id": "task_abc123",
  "client_id": "uuid-of-client",
  "metadata": {
    "completion_notes": "Initial consultation completed",
    "outcome": "success"
  }
}
```

**Sally's Response:**
- Updates `clients.manus_task_status` to "completed"
- Sets `clients.last_manus_update` to current timestamp
- Logs webhook in `webhook_logs` table

---

### `task.scheduled`

**When to Use:** When scheduling a follow-up action for a client

**Payload:**
```json
{
  "event": "task.scheduled",
  "task_id": "task_abc123",
  "client_id": "uuid-of-client",
  "scheduled_time": "2026-02-15T14:00:00Z",
  "metadata": {
    "meeting_type": "follow_up_consultation",
    "location": "Zoom"
  }
}
```

**Sally's Response:**
- Updates `clients.next_follow_up` with scheduled time
- Sets `clients.last_manus_update` to current timestamp
- Logs webhook in `webhook_logs` table

---

### `action.required`

**When to Use:** When triggering a specific action in Sally

**Supported Actions:**
- `make_call` - Schedule or trigger a phone call
- `send_email` - Send follow-up email
- `schedule_meeting` - Schedule a meeting
- `follow_up` - Flag client for general follow-up

**Payload:**
```json
{
  "event": "action.required",
  "task_id": "task_abc123",
  "client_id": "uuid-of-client",
  "action": "follow_up",
  "metadata": {
    "urgency": "high",
    "reason": "Profile expires in 3 days",
    "suggested_action": "Discuss renewal options"
  }
}
```

**Sally's Response:**
- Sets `clients.requires_follow_up` to true
- Sets `clients.last_manus_update` to current timestamp
- Logs webhook in `webhook_logs` table

---

### `reminder.triggered`

**When to Use:** When a scheduled reminder fires in Manus

**Payload:**
```json
{
  "event": "reminder.triggered",
  "task_id": "task_abc123",
  "client_id": "uuid-of-client",
  "metadata": {
    "reminder_type": "profile_expiration",
    "days_remaining": 3
  }
}
```

**Sally's Response:**
- Updates `clients.last_reminder_sent` to current timestamp
- Logs webhook in `webhook_logs` table

---

## Configuration in Manus

### Step 1: Add Webhook Endpoint

1. Open Manus Dashboard
2. Navigate to **Settings** > **Integrations** > **Webhooks**
3. Click **Add Webhook**
4. Configure:
   - **Name:** Sally Client Updates
   - **URL:** `https://gvqhpyzczswpcdnqkppp.supabase.co/functions/v1/sally-webhook`
   - **Method:** POST
   - **Content-Type:** application/json
5. (Optional) Add custom header for verification:
   - **Header:** X-Manus-Signature
   - **Value:** your-secret-key
6. Select events to trigger webhook
7. Save configuration

### Step 2: Create Automation Rules

**Example 1: Profile Expiration Reminder (3 days before)**

```
Trigger: Scheduled check (daily at 9:00 AM)
Condition: Client profile expires in 3 days
Action: POST to Sally webhook
Payload:
{
  "event": "action.required",
  "task_id": "${task.id}",
  "client_id": "${task.context.client_id}",
  "action": "follow_up",
  "metadata": {
    "reason": "Profile expires in 3 days",
    "urgency": "high"
  }
}
```

**Example 2: Task Completion Sync**

```
Trigger: Task status changed to "Completed"
Condition: Task has tag "sally_client"
Action: POST to Sally webhook
Payload:
{
  "event": "task.completed",
  "task_id": "${task.id}",
  "client_id": "${task.context.client_id}",
  "metadata": {
    "completion_notes": "${task.notes}"
  }
}
```

**Example 3: Follow-up Scheduled**

```
Trigger: Calendar event created
Condition: Event linked to Sally client task
Action: POST to Sally webhook
Payload:
{
  "event": "task.scheduled",
  "task_id": "${task.id}",
  "client_id": "${task.context.client_id}",
  "scheduled_time": "${event.start_time}",
  "metadata": {
    "meeting_type": "${event.type}",
    "notes": "${event.notes}"
  }
}
```

---

## Testing the Webhook

### Using cURL

**Test Task Completion:**
```bash
curl -X POST https://gvqhpyzczswpcdnqkppp.supabase.co/functions/v1/sally-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event": "task.completed",
    "task_id": "test_task_001",
    "client_id": "your-actual-client-uuid",
    "metadata": {
      "test": true,
      "notes": "Testing webhook integration"
    }
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "event": "task.completed",
  "task_id": "test_task_001",
  "received": true,
  "client_updated": true
}
```

**Test Action Required:**
```bash
curl -X POST https://gvqhpyzczswpcdnqkppp.supabase.co/functions/v1/sally-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event": "action.required",
    "task_id": "test_task_002",
    "client_id": "your-actual-client-uuid",
    "action": "follow_up",
    "metadata": {
      "urgency": "high"
    }
  }'
```

### Verifying Webhook Logs

```sql
SELECT
  event_type,
  payload->>'task_id' as task_id,
  payload->>'client_id' as client_id,
  processed_at
FROM webhook_logs
WHERE source = 'manus'
ORDER BY created_at DESC
LIMIT 10;
```

### Checking Client Updates

```sql
SELECT
  name,
  email,
  manus_task_status,
  next_follow_up,
  requires_follow_up,
  last_manus_update
FROM clients
WHERE last_manus_update IS NOT NULL
ORDER BY last_manus_update DESC
LIMIT 5;
```

---

## Database Schema

### New Webhook Logs Table

```sql
CREATE TABLE webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,           -- 'manus', 'stripe', etc.
  event_type text NOT NULL,       -- Event type received
  payload jsonb NOT NULL,         -- Full webhook payload
  processed_at timestamptz,       -- Processing timestamp
  created_at timestamptz          -- Log creation timestamp
);
```

### New Client Tracking Fields

| Field | Type | Description |
|-------|------|-------------|
| `last_manus_update` | timestamptz | Last webhook received from Manus |
| `manus_task_status` | text | Status: "pending", "completed", etc. |
| `next_follow_up` | timestamptz | Scheduled follow-up time |
| `requires_follow_up` | boolean | Urgent follow-up flag |
| `last_reminder_sent` | timestamptz | Last reminder timestamp |

---

## Security

### Optional Signature Verification

For production use, configure a shared secret to verify webhooks are from Manus:

**1. In Manus:**
Add custom header when configuring webhook:
```
X-Manus-Signature: your-secret-key-here
```

**2. In Supabase:**
The `MANUS_WEBHOOK_SECRET` environment variable is automatically configured.

If signature is missing, Sally logs a warning but still processes the webhook (fail-open approach for development).

### Access Control

- Webhook endpoint is publicly accessible (no JWT verification)
- All database operations use Supabase service role
- RLS policies protect sensitive data
- Webhook logs are only readable by authenticated users

---

## Monitoring

### Recent Webhooks Query

```sql
SELECT
  source,
  event_type,
  payload->>'client_id' as client_id,
  processed_at,
  created_at
FROM webhook_logs
WHERE created_at > now() - interval '24 hours'
ORDER BY created_at DESC;
```

### Webhook Success Rate

```sql
SELECT
  event_type,
  COUNT(*) as total_webhooks,
  COUNT(CASE WHEN payload->>'success' = 'true' THEN 1 END) as successful
FROM webhook_logs
WHERE source = 'manus'
AND created_at > now() - interval '7 days'
GROUP BY event_type;
```

### Clients Requiring Follow-up

```sql
SELECT
  name,
  email,
  company,
  next_follow_up,
  last_manus_update,
  CASE
    WHEN next_follow_up < now() THEN 'OVERDUE'
    WHEN next_follow_up < now() + interval '24 hours' THEN 'DUE_SOON'
    ELSE 'SCHEDULED'
  END as urgency
FROM clients
WHERE requires_follow_up = true
OR next_follow_up IS NOT NULL
ORDER BY next_follow_up ASC NULLS LAST;
```

---

## Troubleshooting

### Webhook Not Received

**Check Manus Configuration:**
1. Verify webhook URL is correct
2. Check webhook is enabled
3. Verify events are selected
4. Test with Manus webhook testing tool

**Check Supabase Logs:**
1. Go to Supabase Dashboard
2. Navigate to Edge Functions > sally-webhook
3. Click "Logs" tab
4. Look for recent invocations

### Client Not Updated

**Verify client_id:**
- Ensure `client_id` in webhook payload matches actual client UUID in database
- Check client exists: `SELECT * FROM clients WHERE id = 'uuid-here';`

**Check RLS Policies:**
- Service role should have full access
- Verify no RLS errors in Edge Function logs

### Missing Webhook Logs

**Verify Table Exists:**
```sql
SELECT * FROM information_schema.tables WHERE table_name = 'webhook_logs';
```

**Check RLS:**
```sql
SELECT tablename, policyname FROM pg_policies WHERE tablename = 'webhook_logs';
```

---

## Error Responses

### 400 Bad Request
```json
{
  "error": "Invalid payload",
  "success": false
}
```

**Cause:** Malformed JSON or missing required fields

### 500 Internal Server Error
```json
{
  "error": "Database connection failed",
  "success": false
}
```

**Cause:** Database or configuration issue

---

## Complete Integration Flow

### Scenario: Client Pays → Manus Task → Follow-up → Renewal

**Day 1: Payment**
1. Client pays $30 via Stripe
2. Stripe webhook triggers `stripe-webhook` edge function
3. `stripe-webhook` calls `manus-sync` to create Manus task
4. Manus receives task: "New Premium Client: [Name]"

**Day 2: Richard Reviews**
1. Richard opens Manus and sees high-priority task
2. Reviews client context and pain points
3. Schedules consultation for Day 5
4. Manus sends webhook to Sally:
   ```json
   {
     "event": "task.scheduled",
     "client_id": "uuid",
     "scheduled_time": "2026-01-28T14:00:00Z"
   }
   ```
5. Sally updates `clients.next_follow_up`

**Day 5: Consultation**
1. Richard completes consultation
2. Marks task as complete in Manus
3. Manus sends webhook to Sally:
   ```json
   {
     "event": "task.completed",
     "client_id": "uuid"
   }
   ```
4. Sally updates `clients.manus_task_status = 'completed'`

**Day 27: Expiration Reminder**
1. Manus automated rule triggers (3 days before expiration)
2. Sends webhook to Sally:
   ```json
   {
     "event": "action.required",
     "action": "follow_up",
     "client_id": "uuid",
     "metadata": {
       "reason": "Profile expires in 3 days"
     }
   }
   ```
3. Sally sets `clients.requires_follow_up = true`
4. Admin dashboard shows urgent follow-up needed

**Day 28: Renewal Outreach**
1. Richard sees flagged client in admin dashboard
2. Contacts client about renewal
3. Client renews for another 30 days

---

## Best Practices

### 1. Always Include client_id
Even if optional, include `client_id` in webhooks to enable proper tracking and updates.

### 2. Use Descriptive Metadata
Include relevant context in the `metadata` field:
```json
{
  "metadata": {
    "completion_notes": "Client agreed to enterprise plan",
    "next_steps": "Send proposal by Friday",
    "estimated_value": 50000
  }
}
```

### 3. Set Up Monitoring
Regularly review webhook logs to ensure integrations are working:
- Daily: Check for failed webhooks
- Weekly: Review webhook success rate
- Monthly: Audit client follow-up completion rate

### 4. Test in Development
Before enabling automated workflows, test webhooks manually with cURL to verify behavior.

### 5. Document Custom Workflows
If you create custom Manus workflows that use this webhook, document them for future reference.

---

## Support Resources

- **Manus Documentation:** https://manus.im/docs
- **Manus API Reference:** https://open.manus.ai/docs
- **Supabase Edge Functions:** https://supabase.com/docs/guides/functions
- **Integration Guide:** See MANUS_INTEGRATION_GUIDE.md

---

**The Sally webhook enables true bidirectional integration, ensuring Richard never misses a follow-up and every paid client receives proper attention throughout their 30-day profile retention period.**
