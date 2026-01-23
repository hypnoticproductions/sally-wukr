# Manus Integration Guide

## Overview

Sally Wukr now integrates seamlessly with Manus, Richard D. Fortune's workflow automation system. When a client pays for the 30-day profile retention service, a high-priority task is automatically created in Manus with all the strategic context captured during the conversation.

This integration creates a perfect handoff from Sally's AI sales process to Richard's human follow-up workflow.

---

## How It Works

### Automatic Workflow

1. **Client Converses with Sally** - Natural conversation extracts business context
2. **Client Pays $30** - Stripe processes payment for 30-day profile retention
3. **Stripe Webhook Fires** - Payment confirmation triggers automation
4. **Manus Task Created** - High-priority task appears in Richard's Manus workspace
5. **Richard Follows Up** - Complete client context available for consultation

### What Gets Synced to Manus

Each paid client generates a detailed task in Manus containing:

- **Contact Information**: Name, email, company, industry
- **Strategic Context**: Pain points and desired outcomes extracted from conversation
- **Account Details**: Payment amount, date, expiration, conversation quality score
- **Next Steps**: Actionable recommendations with dates
- **Priority Level**: Automatically set to "high" for paid clients

---

## Setup Instructions

### Step 1: Get Your Manus API Key

1. **Create a Manus Account** (if you haven't already)
   - Visit: https://manus.im

2. **Access API Documentation**
   - Go to: https://open.manus.ai/docs

3. **Generate API Key**
   - Navigate to API settings in your Manus dashboard
   - Create a new API key
   - Copy the key (you'll need it in the next step)

### Step 2: Configure in Supabase (Already Done)

The Manus integration edge function is already deployed. The `MANUS_API_KEY` environment variable is automatically configured in your Supabase Edge Functions.

**Note:** If you want to disable Manus integration, simply don't configure the API key. The system will gracefully skip Manus sync without errors.

### Step 3: Test the Integration

1. **Trigger a Test Payment**
   - Start a conversation with Sally
   - Provide your information (name, email, business challenge)
   - Accept the $30 profile retention offer
   - Complete payment with a test card

2. **Verify Task Creation**
   - Check your Manus dashboard
   - Look for a new high-priority task titled "New Premium Client: [Name]"
   - Verify all client details are present

3. **Check Database**
   ```sql
   SELECT id, name, email, payment_status, manus_task_id
   FROM clients
   WHERE payment_status = 'paid'
   ORDER BY created_at DESC
   LIMIT 5;
   ```
   - Confirm `manus_task_id` is populated

---

## Technical Architecture

### Edge Functions

**`manus-sync`** - Creates Manus tasks from client data
- **Endpoint**: `https://[your-project].supabase.co/functions/v1/manus-sync`
- **Method**: POST
- **Auth**: Requires Supabase service role key
- **Payload**: `{ "clientId": "uuid" }`

**`stripe-webhook`** - Enhanced with Manus trigger
- After processing successful payment
- Automatically calls `manus-sync` function
- Stores returned task ID in client record

### Database Schema

**New Column**: `clients.manus_task_id`
- Type: `text` (nullable)
- Purpose: Store Manus task ID for reference
- Indexed: Yes (for fast lookups)

### Service Layer

**`manusService.ts`** - Client-side Manus API wrapper (optional)
- Not required for webhook automation
- Available for manual task creation
- Can be used for custom integrations

---

## Manus Task Structure

### Example Task

```
## New Premium Client: Jane Smith

**Contact Information:**
- Name: Jane Smith
- Email: jane.smith@example.com
- Company: Acme Corp
- Industry: Technology

**Strategic Context:**
- Challenge: Struggling with low conversion rates on website
- Desired Outcome: Increase sales funnel efficiency by 40%

**Account Details:**
- Payment Amount: $30
- Payment Date: January 23, 2026
- Profile Expires: February 22, 2026
- Conversation Quality Score: 85/100

**Next Steps:**
1. Review client strategic context
2. Schedule initial consultation before February 15, 2026
3. Prepare customized proposal based on pain points
4. Follow up 3 days before profile expiration

**Priority:** This is a paid client - high priority for Richard D. Fortune's consulting practice.

**Source:** Sally Wukr AI Assistant
**Client ID:** abc-123-def-456
```

### Task Metadata

Each task includes structured metadata:

```json
{
  "type": "sally_paid_client",
  "client_id": "abc-123-def-456",
  "client_name": "Jane Smith",
  "client_email": "jane.smith@example.com",
  "payment_amount": 30,
  "payment_date": "2026-01-23T10:30:00Z",
  "expires_at": "2026-02-22T10:30:00Z",
  "conversation_score": 85,
  "source": "Sally Wukr AI Assistant"
}
```

---

## Bidirectional Integration: Manus to Sally Webhook

### Overview

Sally can now receive webhook events from Manus, enabling true bidirectional integration. When Manus completes a task, schedules an action, or triggers a reminder, it can notify Sally automatically.

### Webhook Endpoint

**Production URL:**
```
https://gvqhpyzczswpcdnqkppp.supabase.co/functions/v1/sally-webhook
```

**Method:** POST
**Authentication:** Optional (X-Manus-Signature header for verification)
**Content-Type:** application/json

### Supported Events

#### 1. Task Completed
Notifies Sally when a Manus task is completed:

```json
{
  "event": "task.completed",
  "task_id": "task_abc123",
  "client_id": "uuid-of-client",
  "metadata": {
    "client_name": "Jane Smith",
    "notes": "Initial consultation completed successfully"
  }
}
```

**Result:** Updates client record with task completion status.

#### 2. Task Scheduled
Notifies Sally when a follow-up is scheduled:

```json
{
  "event": "task.scheduled",
  "task_id": "task_abc123",
  "client_id": "uuid-of-client",
  "scheduled_time": "2026-02-15T14:00:00Z",
  "metadata": {
    "call_purpose": "follow_up_consultation"
  }
}
```

**Result:** Updates client record with next follow-up time.

#### 3. Action Required
Triggers specific actions in Sally:

```json
{
  "event": "action.required",
  "task_id": "task_abc123",
  "client_id": "uuid-of-client",
  "action": "make_call",
  "metadata": {
    "call_purpose": "renewal_reminder",
    "notes": "Profile expires in 3 days"
  }
}
```

**Supported Actions:**
- `make_call` - Schedule or trigger a call
- `send_email` - Send follow-up email
- `schedule_meeting` - Schedule a meeting
- `follow_up` - Flag client for follow-up

**Result:** Flags client for action in admin dashboard.

#### 4. Reminder Triggered
Logs when Manus sends a reminder:

```json
{
  "event": "reminder.triggered",
  "task_id": "task_abc123",
  "client_id": "uuid-of-client",
  "metadata": {
    "reminder_type": "profile_expiration",
    "days_until_expiration": 3
  }
}
```

**Result:** Updates client with reminder timestamp.

### Setting Up in Manus

#### Step 1: Configure Outbound Webhook

1. **Open Manus Dashboard**
   - Navigate to Settings > Integrations > Webhooks

2. **Add New Webhook**
   - **Name:** Sally Client Updates
   - **URL:** `https://gvqhpyzczswpcdnqkppp.supabase.co/functions/v1/sally-webhook`
   - **Method:** POST
   - **Headers:** (Optional) `X-Manus-Signature: your-secret-key`

3. **Select Events**
   - Task Completed
   - Task Scheduled
   - Action Required
   - Reminder Triggered

4. **Save Configuration**

#### Step 2: Create Workflow Automations

**Example: Profile Expiration Reminder**

```
WHEN: 3 days before client profile expiration
THEN: Send webhook to Sally
PAYLOAD:
{
  "event": "action.required",
  "task_id": "${task.id}",
  "client_id": "${client.metadata.client_id}",
  "action": "follow_up",
  "metadata": {
    "call_purpose": "renewal_reminder",
    "notes": "Profile expires soon - discuss renewal options"
  }
}
```

**Example: Task Completion Sync**

```
WHEN: Task marked as completed
IF: Task type is "sally_paid_client"
THEN: Send webhook to Sally
PAYLOAD:
{
  "event": "task.completed",
  "task_id": "${task.id}",
  "client_id": "${task.metadata.client_id}",
  "metadata": {
    "completion_notes": "${task.completion_notes}"
  }
}
```

### Webhook Logs

All incoming webhooks are logged in the `webhook_logs` table for debugging and auditing:

```sql
SELECT * FROM webhook_logs
WHERE source = 'manus'
ORDER BY created_at DESC
LIMIT 10;
```

**Webhook Log Structure:**
- `id` - Unique log entry ID
- `source` - Always "manus" for Manus webhooks
- `event_type` - The event type received
- `payload` - Full webhook payload (JSONB)
- `processed_at` - Processing timestamp
- `created_at` - Log creation timestamp

### Client Tracking Fields

The webhook updates these fields in the `clients` table:

| Field | Type | Description |
|-------|------|-------------|
| `last_manus_update` | timestamptz | Last time Manus sent an update |
| `manus_task_status` | text | Current status (e.g., "completed") |
| `next_follow_up` | timestamptz | Scheduled follow-up time |
| `requires_follow_up` | boolean | Flag for urgent follow-ups |
| `last_reminder_sent` | timestamptz | Last reminder timestamp |

**Example Query:**

```sql
SELECT
  name,
  email,
  manus_task_status,
  next_follow_up,
  requires_follow_up
FROM clients
WHERE payment_status = 'paid'
AND requires_follow_up = true
ORDER BY next_follow_up ASC;
```

### Security

#### Optional Signature Verification

To verify webhooks are from Manus, configure a shared secret:

1. **In Manus:** Set custom header `X-Manus-Signature: your-secret-key`
2. **In Supabase:** Add environment variable `MANUS_WEBHOOK_SECRET=your-secret-key`

The webhook will log a warning if signature is missing but will still process the request.

#### Access Control

- Webhook endpoint has JWT verification disabled (public access)
- All database operations use service role for security
- RLS policies protect sensitive data
- Webhook logs are only readable by authenticated users

### Testing the Webhook

#### Using cURL

```bash
curl -X POST https://gvqhpyzczswpcdnqkppp.supabase.co/functions/v1/sally-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event": "task.completed",
    "task_id": "test_task_123",
    "client_id": "your-client-uuid-here",
    "metadata": {
      "test": true
    }
  }'
```

#### Expected Response

```json
{
  "success": true,
  "event": "task.completed",
  "task_id": "test_task_123",
  "received": true,
  "client_updated": true
}
```

### Monitoring

#### Check Recent Webhooks

```sql
SELECT
  event_type,
  payload->>'client_id' as client_id,
  payload->>'task_id' as task_id,
  processed_at
FROM webhook_logs
WHERE source = 'manus'
AND created_at > now() - interval '24 hours'
ORDER BY created_at DESC;
```

#### Check Failed Webhooks

Monitor Edge Function logs in Supabase Dashboard:
1. Go to Edge Functions > sally-webhook
2. Click "Logs" tab
3. Look for error messages

### Future Enhancements

### Expiration Reminders (Now Available via Webhook)

Using the webhook, Manus can trigger automatic reminders 3 days before profile expiration. Sally will flag these clients for follow-up in the admin dashboard.

### Custom Task Templates

Allow customization of task format and content via configuration

---

## Troubleshooting

### Task Not Created

**Check Edge Function Logs:**
1. Go to Supabase Dashboard
2. Navigate to Edge Functions
3. Select `stripe-webhook`
4. Check recent invocations for errors

**Common Issues:**
- `MANUS_API_KEY not configured` - API key not set
- `Manus API error: 401` - Invalid API key
- `Manus API error: 400` - Malformed request

**Solution:**
Verify your Manus API key is correct and active

### Task ID Not Stored

If Manus task is created but `manus_task_id` is null:

1. Check database update permissions
2. Verify `manus-sync` function completed successfully
3. Check for database constraint errors

### Duplicate Tasks

If the same client generates multiple tasks:

- This shouldn't happen with current implementation
- Webhook deduplication prevents this
- If it occurs, check Stripe webhook settings for duplicate events

---

## Monitoring & Analytics

### Key Metrics

Track integration health in Supabase:

```sql
-- Successful Manus syncs
SELECT COUNT(*) FROM clients
WHERE payment_status = 'paid'
AND manus_task_id IS NOT NULL;

-- Failed syncs (paid but no task)
SELECT COUNT(*) FROM clients
WHERE payment_status = 'paid'
AND manus_task_id IS NULL;

-- Sync success rate
SELECT
  ROUND(
    100.0 * COUNT(CASE WHEN manus_task_id IS NOT NULL THEN 1 END) / COUNT(*),
    2
  ) as sync_success_rate
FROM clients
WHERE payment_status = 'paid';
```

### Admin Dashboard Enhancement

Future feature: Display Manus task status in Admin Dashboard
- Show task ID and creation status
- Link directly to Manus task
- Display sync timestamp

---

## API Reference

### Create Manus Task (Manual)

**Endpoint**: POST `https://[project].supabase.co/functions/v1/manus-sync`

**Headers**:
```
Content-Type: application/json
Authorization: Bearer [SUPABASE_SERVICE_KEY]
```

**Body**:
```json
{
  "clientId": "uuid-here"
}
```

**Response**:
```json
{
  "success": true,
  "manus_task_id": "task_abc123",
  "client_id": "uuid-here"
}
```

### Manus API Direct

For advanced integrations, use Manus API directly:

**Create Task**: POST `https://open.manus.ai/v1/tasks`

**Headers**:
```
Content-Type: application/json
Authorization: Bearer [MANUS_API_KEY]
```

**Body**:
```json
{
  "task": "Task description in markdown",
  "context": {
    "key": "value"
  },
  "priority": "high"
}
```

---

## Security Considerations

### API Key Protection

- Manus API key is stored in Supabase Edge Function secrets
- Never exposed to client-side code
- Automatically configured in secure environment
- Rotatable without code changes

### Data Privacy

- Only essential client information sent to Manus
- No credit card or payment details included
- Client can request data deletion (GDPR compliant)
- Manus access controlled by Richard's account permissions

### Webhook Security

- Stripe webhook signature verification prevents spoofing
- Manus sync only triggered after payment verification
- Database RLS policies prevent unauthorized access
- All communication over HTTPS

---

## Cost Considerations

### Manus Pricing

Check current Manus pricing at: https://manus.im/pricing

Typical usage:
- 1 task per paid client
- Estimated monthly volume: 10-50 tasks
- Cost: Variable based on Manus plan

### Alternative: No Manus

If you prefer not to use Manus:
- Simply don't configure the `MANUS_API_KEY`
- System will skip Manus sync gracefully
- All other features continue to work
- Use Admin Dashboard to view paid clients manually

---

## Support Resources

### Documentation Links

- **Manus Documentation**: https://manus.im/docs/introduction/welcome
- **Manus API Reference**: https://open.manus.ai/docs
- **Manus Integrations**: https://manus.im/docs/integrations/integrations

### Contact Support

For Manus integration issues:
1. Check Edge Function logs in Supabase
2. Verify API key is active
3. Review this guide's troubleshooting section
4. Contact Manus support for API-specific issues

---

## Example Workflow

### Real-World Scenario

**Day 1**: Client "Sarah Chen" talks to Sally about her e-commerce conversion problems

**Day 1 (10 minutes later)**: Sarah pays $30 to secure her profile

**Day 1 (immediately)**:
- Stripe processes payment
- Database updated: `payment_status = 'paid'`, `profile_expires_at = '30 days from now'`
- Manus task created with Sarah's full context
- Richard sees "New Premium Client: Sarah Chen" in his Manus dashboard

**Day 2**: Richard reviews Sarah's pain points and prepares consultation

**Day 3**: Richard reaches out to Sarah with customized proposal

**Day 27**: Automated reminder: "Sarah's profile expires in 3 days"

**Day 30**: Sarah's profile expires (or she renews for another 30 days)

---

**The Manus integration transforms Sally from a lead capture tool into a complete sales handoff system, ensuring no paid client falls through the cracks.**
