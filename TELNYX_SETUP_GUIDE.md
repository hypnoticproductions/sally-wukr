# Telnyx Voice Calling Setup Guide

## Overview

Your application now has a complete Telnyx voice calling system integrated with Sally, Manus, and Quintapoo. This guide will help you set up Telnyx and configure the system.

---

## Phase 1: Telnyx Account Setup

### Step 1: Create Telnyx Account

1. Go to [Telnyx Portal](https://portal.telnyx.com/)
2. Sign up for a new account (free trial available)
3. Complete account verification

### Step 2: Purchase a Phone Number

1. Navigate to **Numbers** > **My Numbers** in the Telnyx Portal
2. Click **Buy Numbers**
3. Search for a phone number in your area
4. Select a number with **Voice** capability enabled
5. Complete the purchase ($1-4/month)

### Step 3: Create a Voice Connection

1. Go to **Voice** > **Connections** in the Telnyx Portal
2. Click **Create New Connection**
3. Select **Call Control Application**
4. Name it "Sally Voice System" (or similar)
5. Copy the **Connection ID** (you'll need this later)

### Step 4: Configure Webhook URLs

In your Connection settings, configure these webhook URLs:

**Primary Webhook URL:**
```
https://gvqhpyzczswpcdnqkppp.supabase.co/functions/v1/telnyx-webhook
```

**Inbound Call Webhook URL:**
```
https://gvqhpyzczswpcdnqkppp.supabase.co/functions/v1/sally-inbound-call
```

Enable these webhook events:
- call.initiated
- call.ringing
- call.answered
- call.hangup
- call.machine.detection.ended
- call.recording.saved

### Step 5: Link Number to Connection

1. Go to **Numbers** > **My Numbers**
2. Click on your purchased number
3. Under **Voice Settings**, select your Connection
4. Save changes

### Step 6: Get API Key

1. Go to **API Keys** in the Telnyx Portal
2. Click **Create API Key**
3. Name it "Sally Voice Integration"
4. Copy the API key (you'll only see this once!)

---

## Phase 2: Configure Supabase Secrets

The following secrets need to be added to your Supabase project. They're automatically available to all Edge Functions.

### In Supabase Dashboard:

1. Go to **Project Settings** > **Edge Functions**
2. Add these secrets:

| Secret Name | Value | Description |
|-------------|-------|-------------|
| `TELNYX_API_KEY` | Your Telnyx API key | From Step 6 above |
| `TELNYX_PHONE_NUMBER` | +15551234567 | Your purchased phone number |
| `TELNYX_CONNECTION_ID` | conn_xxxxx | From Step 3 above |
| `RICHARD_PHONE_NUMBER` | +15559876543 | Richard's phone for transfers (optional) |

---

## Phase 3: Database Setup

The database schema has already been created with these tables:

### Tables Created:

1. **calls** - Tracks all inbound and outbound calls
2. **call_attempts** - Retry tracking for failed calls
3. **call_recordings** - Call recordings and transcripts

### Client Table Updates:

Added fields to the `clients` table:
- `phone_number` - Client's phone number
- `phone_verified` - Phone validation status
- `call_preferences` - DNC list, preferred time, timezone
- `last_call_at` - Last call timestamp
- `next_follow_up` - When to call next

---

## Phase 4: How to Use the System

### Manual Calling (Phase 1 Rollout)

1. Add phone numbers to client records in the database
2. Open the Admin Dashboard
3. Click the "Call" button next to any client with a phone number
4. Sally will initiate an outbound call via Telnyx

### Call Flow:

**Outbound Call:**
```
Admin clicks "Call" button
↓
telnyx-call function initiates call
↓
Telnyx Call Control API dials client
↓
telnyx-webhook receives real-time updates
↓
Call state updates in database
↓
Recording stored when call ends
```

**Inbound Call:**
```
Client calls your Telnyx number
↓
sally-inbound-call receives webhook
↓
Sally looks up caller by phone number
↓
Queries Quintapoo for client history
↓
Plays personalized greeting
↓
IVR menu: Press 1 for Richard, 2 for voicemail
↓
Transfer to Richard or record message
```

### Automated Calling (Phase 2-4 Rollout)

Once Manus integration is complete:

1. Manus sends `action.required` + `make_call` event
2. sally-webhook triggers telnyx-call automatically
3. Sally queries Quintapoo before calling
4. Call placed at scheduled time
5. Results logged to database

### Scheduled Calls (Cron Job)

The `scheduled-calls` function runs automatically:

1. Queries clients where `next_follow_up` is due
2. Checks if phone number exists
3. Verifies not on do-not-call list
4. Queries Quintapoo for client context
5. Places call automatically
6. Updates next follow-up timestamp

To trigger manually:
```bash
curl -X POST \
  https://gvqhpyzczswpcdnqkppp.supabase.co/functions/v1/scheduled-calls \
  -H "Authorization: Bearer YOUR_SUPABASE_KEY"
```

---

## Phase 5: Testing

### Test Outbound Calling:

1. Add your own phone number to a test client
2. Click "Call" in the Admin Dashboard
3. Verify you receive the call
4. Check database for call record

### Test Inbound Calling:

1. Call your Telnyx number from your phone
2. Listen to Sally's greeting
3. Test IVR options (press 1 or 2)
4. Verify call logged in database

### Test Webhooks:

Check Telnyx Portal logs:
- Go to **Debugging** > **Event Logs**
- Verify webhooks are being delivered
- Check for any errors

---

## Features Implemented

### Admin Dashboard:

- Call statistics dashboard (total, inbound, outbound, avg duration)
- Recent calls history view
- One-click calling from client list
- Real-time call state updates

### Edge Functions Deployed:

1. **telnyx-call** - Initiates outbound calls
2. **telnyx-webhook** - Handles call state updates
3. **sally-inbound-call** - Manages inbound calls with AI
4. **scheduled-calls** - Automated follow-up calling

### Database Features:

- Full call history tracking
- Dual-channel call recordings
- Call attempt retry logic
- Client call preferences (DNC list)
- Automated call scheduling

---

## Cost Estimates

### Telnyx Pricing:

- Phone number: $1-4/month
- Outbound calls: $0.004-0.008/minute (US)
- Inbound calls: $0.004-0.006/minute (US)
- Call recording: $0.0015/minute
- SMS (included free): $0.004/message

### Example Monthly Cost:

**Low Volume (50 calls/month, 5 min avg):**
- Phone number: $2/month
- Calling: $1.50-3.00
- Recording: $0.38
- **Total: ~$5/month**

**Medium Volume (200 calls/month, 5 min avg):**
- Phone number: $2/month
- Calling: $6-12
- Recording: $1.50
- **Total: ~$15/month**

**High Volume (1000 calls/month, 5 min avg):**
- Phone number: $2/month
- Calling: $20-40
- Recording: $7.50
- **Total: ~$40/month**

---

## Next Steps

### Immediate:

1. Set up Telnyx account and purchase phone number
2. Configure Supabase secrets
3. Test manual calling from Admin Dashboard

### Phase 2 (Week 3-4):

1. Connect sally-webhook to trigger calls from Manus
2. Implement call scheduling based on `next_follow_up`
3. Monitor automated calls

### Phase 3 (Week 5-6):

1. Set up scheduled-calls cron job (every 15 minutes)
2. Test automated outreach
3. Integrate SMS follow-up for voicemails

### Phase 4 (Week 7+):

1. Enable full Sally autonomy
2. Real-time Quintapoo integration
3. AI-generated call scripts
4. Post-call briefing to Manus

---

## Troubleshooting

### Calls Not Connecting:

- Verify webhook URLs are correct
- Check Telnyx Event Logs for errors
- Confirm phone number is linked to Connection
- Verify API key is valid

### Webhooks Not Received:

- Check Supabase Edge Function logs
- Verify webhook URL is publicly accessible
- Confirm webhook signature validation (if enabled)

### Database Errors:

- Check Supabase logs for RLS policy issues
- Verify service role key is configured
- Confirm tables were created successfully

---

## Support

### Telnyx Documentation:
- [Call Control API](https://developers.telnyx.com/docs/api/v2/call-control)
- [Webhook Guide](https://developers.telnyx.com/docs/v2/call-control/webhooks)

### Telnyx Support:
- Portal: [https://portal.telnyx.com/](https://portal.telnyx.com/)
- Email: support@telnyx.com
- Status: [status.telnyx.com](https://status.telnyx.com/)

---

## Architecture Overview

```
┌─────────────────┐
│  Admin Dashboard │
│   (Manual Call)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────┐
│  telnyx-call    │─────▶│  Telnyx API  │
│  Edge Function  │      │ Call Control │
└────────┬────────┘      └──────┬───────┘
         │                      │
         │                      ▼
         │              ┌──────────────┐
         │              │  Phone Call  │
         │              │   (Client)   │
         │              └──────┬───────┘
         │                     │
         ▼                     ▼
┌─────────────────┐    ┌──────────────┐
│ telnyx-webhook  │◀───│   Webhooks   │
│  Edge Function  │    │ (Real-time)  │
└────────┬────────┘    └──────────────┘
         │
         ▼
┌─────────────────┐
│    Supabase     │
│    Database     │
│  (Call Records) │
└─────────────────┘
```

---

## Sally Autonomous Workflow (Future)

```
Scheduled Time Reached
         │
         ▼
┌─────────────────┐
│ scheduled-calls │
│   Cron Job      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Query Quintapoo │
│ (Client History)│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Generate AI    │
│  Call Script    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Place Call via │
│  Telnyx API     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Extract Action  │
│ Items from Call │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Create Task    │
│   in Manus      │
└─────────────────┘
```

---

## Congratulations!

Your voice calling system is now ready for Phase 1 testing. Start by making manual calls from the Admin Dashboard, then gradually roll out automation as you gain confidence in the system.
