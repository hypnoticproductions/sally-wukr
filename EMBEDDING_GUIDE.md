# Sally Wukr - Embedding Guide

This guide explains how to embed the Sally Wukr voice assistant widget into any website.

## Current Status

Your app is currently set up as a standalone application. To make it fully embeddable, you need to complete the following steps:

## Quick Start (Current Implementation)

For now, you can embed the app using an iframe:

```html
<iframe
  src="https://your-domain.com"
  width="500"
  height="800"
  allow="microphone"
  style="border: none; border-radius: 20px;"
></iframe>
```

**Important:** The iframe must include `allow="microphone"` to enable voice functionality.

## Security Considerations

### Google API Key Setup

The app currently requires a Google Gemini API key to be configured in your environment variables. For security:

1. **For Development:** Add your API key to `.env` as `VITE_GEMINI_API_KEY`
2. **For Production:**
   - Set the API key in your hosting environment variables
   - Restrict the API key to specific domains in Google Cloud Console
   - Never commit API keys to version control

### Recommended: Domain Restrictions

To prevent unauthorized use of your API key:

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Select your API key
3. Under "Application restrictions", choose "HTTP referrers (websites)"
4. Add your production domains:
   ```
   https://yourdomain.com/*
   https://www.yourdomain.com/*
   ```

## Completed Security Improvements

✅ **Edge Function Proxy**: Brief generation now uses a secure server-side proxy
✅ **Database Persistence**: All conversations are saved to Supabase
✅ **Session Tracking**: Each conversation session is tracked with metadata
✅ **RLS Policies**: Row Level Security protects data in Supabase

## Remaining Work for Full Embeddability

The following features still need to be implemented to make this a truly embeddable widget:

### 1. Widget Mode (High Priority)

Create a compact widget version that can float on any website:
- Small button that expands to full interface
- Configurable position (bottom-right, bottom-left, etc.)
- CSS isolation using Shadow DOM
- Z-index management for proper layering

### 2. Script Tag Embedding (High Priority)

Allow embedding via a simple script tag:
```html
<script src="https://cdn.yourdomain.com/sally-widget.js"></script>
<script>
  SallyWidget.init({
    position: 'bottom-right',
    theme: 'light',
    apiKey: 'optional-if-using-backend'
  });
</script>
```

### 3. AudioWorklet Implementation (Medium Priority)

Replace the deprecated ScriptProcessorNode with AudioWorklet for:
- Better performance
- Lower latency
- Modern browser compatibility

### 4. Configuration System (Medium Priority)

Add runtime configuration for:
- Custom branding (colors, logos, text)
- Behavior customization (auto-open, greeting message)
- Integration callbacks (onConversationEnd, onBriefGenerated)

### 5. Cross-Origin Support (Medium Priority)

Properly handle cross-origin scenarios:
- CORS configuration in Vite
- Iframe sandboxing policies
- PostMessage API for parent-child communication

### 6. Offline/Error Handling (Low Priority)

Improve user experience when:
- No internet connection
- Microphone access denied
- API quota exceeded
- Network timeouts

## How to Use (Current Implementation)

1. **Add your Google API key:**
   ```bash
   # In your .env file
   VITE_GEMINI_API_KEY=your_actual_api_key_here
   ```

2. **Build the app:**
   ```bash
   npm run build
   ```

3. **Deploy the `dist` folder** to your hosting provider (Vercel, Netlify, etc.)

4. **Embed using iframe** on any website where you want Sally to appear

## Next Steps

To transform this into a production-ready embeddable widget:

1. **Implement widget mode** with a floating button
2. **Create build pipeline** for generating a standalone widget bundle
3. **Add Shadow DOM** for CSS isolation
4. **Create configuration API** for customization
5. **Replace ScriptProcessorNode** with AudioWorklet
6. **Add comprehensive error handling** and user feedback
7. **Create demo page** showing various embedding options

## Testing Checklist

Before deploying to production:

- [ ] Test microphone permissions in different browsers
- [ ] Verify voice streaming works on HTTPS
- [ ] Test conversation persistence in database
- [ ] Verify brief generation via edge function
- [ ] Test on mobile devices
- [ ] Verify API key restrictions work
- [ ] Test error scenarios (no mic, no internet, etc.)
- [ ] Load test the edge function
- [ ] Monitor Supabase database performance

## Support

For issues or questions:
- Check browser console for errors
- Verify environment variables are set correctly
- Ensure HTTPS is enabled in production
- Check Supabase dashboard for database errors
- Review edge function logs in Supabase

## Architecture Diagram

```
┌─────────────┐
│   Website   │
│   (Parent)  │
└──────┬──────┘
       │ iframe or script tag
       ▼
┌─────────────────────────────┐
│    Sally Widget (Frontend)   │
│  ┌─────────────────────────┐│
│  │  Voice Streaming         ││
│  │  (Direct to Gemini)      ││
│  └─────────────────────────┘│
│  ┌─────────────────────────┐│
│  │  Brief Generation        ││
│  │  (via Edge Function)     ││
│  └───────────┬─────────────┘│
└──────────────┼──────────────┘
               │
               ▼
    ┌──────────────────┐
    │  Supabase Backend │
    │ ┌──────────────┐ │
    │ │ Edge Function │ │
    │ │ (gemini-proxy)│ │
    │ └──────┬───────┘ │
    │ ┌──────▼───────┐ │
    │ │   Database    │ │
    │ │  (sessions,   │ │
    │ │   messages,   │ │
    │ │   briefs)     │ │
    │ └──────────────┘ │
    └──────────────────┘
               │
               ▼
    ┌──────────────────┐
    │  Google Gemini   │
    │      API         │
    └──────────────────┘
```
