# Sally's $30 Paid Profile System - Complete Guide

## Overview

Sally is your AI sales consultant that naturally converses with potential clients, extracts business intelligence, and offers a **$30/30-day strategic profile retention service**. This system includes persuasive sales techniques, payment processing via Stripe, client management, and automated expiration tracking.

---

## Core Concept

**The 30-Day Window Philosophy:**
- Clients pay $30 to keep their strategic profile active for 30 days
- Creates accountability and urgency for action
- After 30 days without renewal, profiles expire and are archived
- Protects both parties from outdated information

---

## Features Implemented

### 1. Database Schema (`clients` & `payment_transactions` tables)
- Client profiles with payment status tracking
- Business intelligence extraction (name, company, pain points, goals)
- Payment history and transaction audit trail
- Profile expiration timestamps
- Conversation quality scoring

### 2. Stripe Payment Integration
- **Edge Functions:**
  - `create-checkout-session` - Creates Stripe Checkout sessions
  - `stripe-webhook` - Handles payment confirmations
  - `check-expiring-profiles` - Monitors and updates expired profiles

### 3. Sally's Conversation Flow
Sally operates through distinct phases:
- **GREETING** - Initial welcome and rapport building
- **DISCOVERY** - Extracting business context naturally
- **READY_FOR_PITCH** - Sufficient information gathered
- **PITCHING** - Delivering the $30 value proposition
- **PAYMENT_OFFERED** - Payment modal displayed
- **PAID** - Premium client with active profile

### 4. Sally's Sales Pitch (Built-in)
```
"[Name], I've captured some powerful strategic context about [their pain points].
Here's the thing - in 30 days, business priorities shift, details fade, and
momentum disappears.

For just $30, I'll keep your complete strategic profile active so when you're
ready to move forward, we don't start from scratch. This 30-day window gives
you accountability to take action while your insights are fresh.

Think of it as locking in this strategic moment before it slips away.
Want to secure your profile?"
```

### 5. Payment Modal UI
- Beautiful, professional Stripe-powered checkout
- Highlights value proposition with client's own pain points
- Shows security badges and 7-day money-back guarantee
- One-click payment experience

### 6. Admin Dashboard (`/admin`)
Access comprehensive client and revenue management:
- Total revenue tracking
- Client status breakdown (paid/free/expired)
- Individual client profiles with scores
- Expiration warnings for profiles ending soon
- Conversion rate analytics
- Quick stats and urgent action items

### 7. Profile Expiration System
- Automatic expiration checking via edge function
- 30-day countdown from payment date
- Grace period handling
- Email reminder capability (ready to integrate)

---

## Setup Instructions

### Step 1: Stripe Configuration

1. **Create a Stripe Account**
   - Go to https://dashboard.stripe.com/register
   - Complete account setup

2. **Get Your API Keys**
   - Navigate to Developers > API Keys
   - Copy your Publishable Key and Secret Key

3. **Update Environment Variables**
   - Add to `.env` file:
     ```
     VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
     ```
   - The `STRIPE_SECRET_KEY` for Edge Functions is automatically configured

4. **Configure Webhook**
   - In Stripe Dashboard, go to Developers > Webhooks
   - Add endpoint: `https://your-project.supabase.co/functions/v1/stripe-webhook`
   - Select events: `checkout.session.completed`, `payment_intent.payment_failed`
   - Copy the Webhook Secret
   - Add to Supabase Edge Function secrets as `STRIPE_WEBHOOK_SECRET`

### Step 2: Database Setup

The database schema is already deployed. Verify tables exist:
```sql
-- Check tables
SELECT * FROM clients LIMIT 5;
SELECT * FROM payment_transactions LIMIT 5;
```

### Step 3: Test the System

1. **Start Development Server**
   ```bash
   npm run dev
   ```

2. **Test Sally's Conversation**
   - Click "Consult Sally" button (bottom right)
   - Engage in natural conversation
   - Provide: name, email, business challenge
   - Watch Sally build rapport and extract information

3. **Trigger Payment Offer**
   - After 5+ quality messages
   - Sally will naturally transition to the pitch
   - Click "Secure Profile - $30" button

4. **Test Payment Flow**
   - Use Stripe test card: `4242 4242 4242 4242`
   - Any future expiry date
   - Any 3-digit CVC
   - Any ZIP code

5. **Verify Payment Success**
   - Check database: `SELECT * FROM clients WHERE payment_status = 'paid';`
   - Check transactions: `SELECT * FROM payment_transactions;`
   - Confirm 30-day expiration date is set

### Step 4: Access Admin Dashboard

Navigate to `/admin` in your browser:
```
http://localhost:5173/admin
```

**Dashboard Features:**
- Revenue overview
- Client list with filters
- Conversion analytics
- Expiration warnings
- Client profiles with scores

### Step 5: Production Deployment

1. **Update Environment Variables for Production**
   - Use live Stripe keys (starts with `pk_live_` and `sk_live_`)
   - Update `.env` with production values

2. **Configure Production Webhook**
   - Add production webhook endpoint in Stripe
   - Use your live domain URL

3. **Set Up Automated Expiration Checking**
   - Schedule `check-expiring-profiles` edge function
   - Run daily via cron job or Supabase scheduled functions
   - Example: Call `https://your-project.supabase.co/functions/v1/check-expiring-profiles` daily

---

## How Sally Sells

### Conversation Quality Scoring
Sally tracks information extraction and assigns scores:
- Name provided: +20 points
- Email provided: +20 points
- Company provided: +15 points
- Pain points identified: +25 points
- Desired outcome shared: +20 points

**Threshold:** When score ≥ 60 and 5+ messages, Sally transitions to pitch mode.

### Natural Information Extraction
Sally uses conversational AI to detect:
- Email addresses (regex pattern matching)
- Names (trigger words: "my name is", "I am", "call me")
- Business challenges (problem keywords)
- Goals and outcomes (goal-oriented language)

### Objection Handling (Future Enhancement)
Currently, Sally presents the offer once. Future versions can include:
- "Too expensive" → Emphasize time saved and opportunity cost
- "I'll think about it" → Create urgency with limited-time framing
- "Not ready" → Highlight risk of losing momentum

---

## Revenue Model

### Pricing Strategy
- **$30** - Sweet spot between accessible and commitment-signaling
- Low enough to avoid major objections
- High enough to filter serious prospects
- No recurring billing complexity

### Conversion Expectations
- **Baseline:** 15-25% conversion from engaged conversations
- **Optimized:** 30-40% with refined pitch timing
- **100 conversations/month** at 25% = **$750/month** passive revenue
- Each paid client = pre-qualified lead for Richard

### Lifetime Value Calculation
- Initial $30 payment
- Potential renewal at 30 days (+$30)
- Conversion to full consulting engagement ($XXk)
- Attribution tracking: Sally → Richard → Deal Closed

---

## Key Files Reference

### Database
- `/supabase/migrations/create_clients_and_payments_schema.sql` - Schema definition

### Edge Functions
- `/supabase/functions/create-checkout-session/index.ts` - Payment creation
- `/supabase/functions/stripe-webhook/index.ts` - Payment confirmation
- `/supabase/functions/check-expiring-profiles/index.ts` - Expiration monitoring

### Frontend Components
- `/components/Assistant.tsx` - Sally's chat interface with sales logic
- `/components/PaymentModal.tsx` - Stripe payment UI
- `/components/AdminDashboard.tsx` - Revenue and client management

### Services
- `/services/clientService.ts` - Database operations for clients
- `/services/geminiService.ts` - AI conversation handling

### Types
- `/types.ts` - TypeScript interfaces (Client, PaymentTransaction, ConversationPhase)

---

## Monitoring & Analytics

### Key Metrics to Track
1. **Conversion Rate**: Paid clients / Total conversations
2. **Average Conversation Length**: Messages before pitch
3. **Quality Score Distribution**: Are we extracting good info?
4. **Payment Success Rate**: Checkout completions vs. abandonments
5. **Renewal Rate**: Clients who renew after 30 days
6. **Lifetime Value**: Initial payment + renewals + consulting deals

### Dashboard Insights
- Filter clients by status (all/paid/free/expired)
- View days until expiration for paid clients
- Track total revenue and client counts
- Identify high-value clients (score > 80)
- Monitor urgent actions (expiring within 5 days)

---

## Future Enhancements

### Email Automation
- Payment confirmation receipts
- 25-day expiration warning
- 28-day "last chance" reminder
- 30-day final notice
- 32-day grace period offer
- 37-day deletion warning

### Payment Options
- Add 60-day ($50) and 90-day ($70) packages
- Implement auto-renewal opt-in
- Offer "lifetime profile" at $200

### Sales Optimization
- A/B test different pitch scripts
- Vary timing of payment offer (5 vs. 7 vs. 10 messages)
- Test social proof inclusion
- Experiment with urgency tactics

### Integration with Manus
- Flag paid clients as high-priority in Richard's workflow
- Auto-create follow-up tasks before expiration
- Link payment data to deal pipeline
- Calculate ROI: Sally → Closed Revenue

---

## Troubleshooting

### Payment Not Processing
1. Check Stripe API keys in `.env`
2. Verify webhook endpoint is correct
3. Check Stripe Dashboard > Developers > Events for errors
4. Ensure `STRIPE_WEBHOOK_SECRET` is configured

### Client Not Found
1. Verify client was created in database
2. Check `localStorage` for `sally_client_id`
3. Ensure email address is correctly extracted

### Expiration Not Working
1. Manually trigger: `https://your-project.supabase.co/functions/v1/check-expiring-profiles`
2. Check Edge Function logs
3. Verify `profile_expires_at` field is populated

### Sally Not Offering Payment
1. Check conversation quality score
2. Ensure at least 5 messages exchanged
3. Verify name + email + pain points extracted
4. Check `conversationPhase` state in browser DevTools

---

## Security Considerations

### PCI Compliance
- All card data handled by Stripe (we never see it)
- Use Stripe Checkout (hosted payment page)
- No card storage in our database

### Data Protection
- RLS enabled on all tables
- Stripe customer IDs encrypted in transit
- Profile data deleted after grace period (37 days)

### Fraud Prevention
- Monitor for repeated failed payments
- Track IP addresses for suspicious activity
- Implement rate limiting on checkout creation

---

## Support & Contact

For questions about Sally's payment system:
- **Developer:** Review code in `/components/Assistant.tsx`
- **Database:** Check Supabase dashboard
- **Payments:** Stripe Dashboard > Payments
- **Edge Functions:** Supabase Dashboard > Edge Functions

---

## Success Metrics

### Launch Goals (First 30 Days)
- [ ] 50+ conversations initiated
- [ ] 10+ paid conversions (20% conversion rate)
- [ ] $300 revenue generated
- [ ] 0 payment failures or disputes
- [ ] 5+ returning paid clients

### Growth Goals (First 90 Days)
- [ ] 200+ conversations
- [ ] 50+ paid conversions (25% conversion rate)
- [ ] $1,500 revenue
- [ ] 20% renewal rate
- [ ] 3+ conversions to full consulting deals

---

**Sally is ready to start generating revenue while qualifying leads for Richard. The 30-day model creates the perfect balance of commitment and flexibility, with automated systems handling expiration tracking and client management.**
