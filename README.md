# Sally Wukr Voice Interface

A secure, embeddable voice AI assistant powered by Google's Gemini Live API and Supabase.

## Features

- Real-time voice conversation with AI assistant "Sally Wukr"
- Secure API key management via Supabase Edge Functions
- Conversation persistence in Supabase database
- Automated briefing generation for lead qualification
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

### Edge Functions
- `gemini-proxy` - Secure proxy for Gemini API calls (brief generation)

## Embedding Guide

This widget can be embedded in any website. Full embedding documentation coming soon.

## Development Notes

- Voice streaming uses deprecated ScriptProcessorNode (AudioWorklet upgrade pending)
- Microphone access requires HTTPS in production
- Cross-origin embedding requires proper iframe permissions
