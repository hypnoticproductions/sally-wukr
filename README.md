# Sally Wukr Voice Interface

A secure, embeddable voice AI assistant powered by Google's Gemini Live API and Supabase.

## Features

- Real-time voice conversation with AI assistant "Sally Wukr"
- Secure API key management via Supabase Edge Functions
- Conversation persistence in Supabase database
- Automated briefing generation for lead qualification
- Stripe payment integration for 30-day profile retention
- Manus workflow automation integration (bidirectional)
- Webhook endpoint for receiving task updates from external systems
- Admin dashboard for client and payment management
- Embeddable widget ready for any website

## Prerequisites

- Node.js 18+
- Supabase account (database and edge functions are pre-configured)
- Google Gemini API key ([Get one here](https://aistudio.google.com/apikey))

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```

   Then edit `.env` and add your Google Gemini API key:
   ```
   VITE_GEMINI_API_KEY=your_gemini_api_key_here
   ```

   Note: Supabase credentials are already configured. The Edge Function will use the `GEMINI_API_KEY` secret (already configured in Supabase).

3. **Run the development server:**
   ```bash
   npm run dev
   ```

   The app will be available at `http://localhost:3000`

4. **Build for production:**
   ```bash
   npm run build
   ```

## Architecture

### Security
- Google API keys are protected via Supabase Edge Functions
- Gemini Live API (voice streaming) uses client-side key with domain restrictions recommended
- Brief generation uses server-side proxy to hide API keys
- All conversations are stored securely in Supabase with Row Level Security

### Database Schema
- `sessions` - Tracks conversation sessions
- `messages` - Stores conversation transcripts
- `briefs` - Stores generated briefing documents
- `clients` - Manages client profiles and payment status
- `payment_transactions` - Records Stripe payment transactions
- `webhook_logs` - Logs incoming webhooks from external systems

### Edge Functions
- `gemini-proxy` - Secure proxy for Gemini API calls (brief generation)
- `create-checkout-session` - Creates Stripe payment sessions
- `stripe-webhook` - Handles Stripe payment events
- `manus-sync` - Syncs paid clients to Manus workflow system
- `sally-webhook` - Receives task updates and signals from Manus
- `check-expiring-profiles` - Monitors profile expiration dates

## Integration Guides

- **[Embedding Guide](EMBEDDING_GUIDE.md)** - How to embed Sally in your website
- **[Manus Integration Guide](MANUS_INTEGRATION_GUIDE.md)** - Complete guide for Manus workflow integration
- **[Sally Webhook Guide](SALLY_WEBHOOK_GUIDE.md)** - Webhook endpoint documentation for bidirectional integrations
- **[Payments Guide](SALLY_PAYMENTS_GUIDE.md)** - Stripe payment setup and configuration

### Webhook Endpoint

Sally can receive webhooks from external systems like Manus:

```
POST https://gvqhpyzczswpcdnqkppp.supabase.co/functions/v1/sally-webhook
```

Supported events:
- `task.completed` - Task completion notifications
- `task.scheduled` - Scheduled follow-up sync
- `action.required` - Trigger specific actions
- `reminder.triggered` - Reminder notifications

See [SALLY_WEBHOOK_GUIDE.md](SALLY_WEBHOOK_GUIDE.md) for complete documentation.

## Development Notes

- Voice streaming uses deprecated ScriptProcessorNode (AudioWorklet upgrade pending)
- Microphone access requires HTTPS in production
- Cross-origin embedding requires proper iframe permissions
