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

## Future Enhancements

### Expiration Reminders

Planned feature: Automatic Manus tasks 3 days before profile expiration

```
## Profile Expiration Reminder: Jane Smith

**Client:** Jane Smith (jane.smith@example.com)
**Expiration Date:** February 22, 2026

**Action Required:**
- Contact client to discuss renewal
- Assess progress since initial payment
- Offer renewal or consulting engagement

**Urgency:** Profile expires in 3 days - immediate action required.
```

### Task Status Sync (Bidirectional)

Future capability: Sync task completion status back to Supabase
- Mark clients as "contacted" when task is completed in Manus
- Track consultation scheduling
- Monitor conversion to full consulting engagement

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
