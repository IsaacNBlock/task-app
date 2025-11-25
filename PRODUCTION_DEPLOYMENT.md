# Production Deployment Guide

This guide covers updating environment variables and configurations for production deployment.

## Table of Contents

1. [Environment Variables for Production](#environment-variables-for-production)
2. [Switching Stripe from Test to Live Mode](#switching-stripe-from-test-to-live-mode)
3. [Updating Webhook Endpoints](#updating-webhook-endpoints)
4. [Updating OAuth Redirect URIs](#updating-oauth-redirect-uris)
5. [Configuring Supabase CORS and Redirect URLs](#configuring-supabase-cors-and-redirect-urls)
6. [Vercel Deployment Checklist](#vercel-deployment-checklist)

---

## Environment Variables for Production

### Frontend Environment Variables (Vercel/Deployment Platform)

Add these to your deployment platform's environment variables:

```bash
# Supabase Production Credentials
NEXT_PUBLIC_SUPABASE_URL=https://your-production-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-production-anon-key

# Stripe Production Keys
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxx
```

**Where to find these values:**
- **Supabase URL & Anon Key**: Supabase Dashboard → Project Settings → API
- **Stripe Publishable Key**: Stripe Dashboard → Developers → API Keys (Live mode)

### Supabase Edge Function Secrets

Update your Supabase edge function secrets for production:

```bash
# Set production Supabase secrets
supabase secrets set STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxx
supabase secrets set STRIPE_PRICE_ID=price_xxxxxxxxxxxxx  # Your LIVE price ID
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx  # Production webhook secret
supabase secrets set OPENAI_API_KEY=sk-xxxxxxxxxxxxx  # Your OpenAI API key
```

**Note:** Supabase automatically provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to edge functions, so you don't need to set those manually.

**How to set secrets:**
```bash
# Make sure you're linked to your production project
supabase link --project-ref your-production-project-ref

# Set each secret
supabase secrets set STRIPE_SECRET_KEY=sk_live_xxx
supabase secrets set STRIPE_PRICE_ID=price_xxx
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx
supabase secrets set OPENAI_API_KEY=sk-xxx
```

---

## Switching Stripe from Test to Live Mode

### Step 1: Get Live Mode API Keys

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Toggle from **Test mode** to **Live mode** (top right)
3. Navigate to **Developers → API Keys**
4. Copy your **Publishable key** (`pk_live_...`) and **Secret key** (`sk_live_...`)

### Step 2: Create Production Subscription Product

If you haven't already, create your subscription product in **Live mode**:

```bash
# Make sure you're using live mode
stripe prices create \
  --currency=usd \
  --unit-amount=1000 \
  -d "recurring[interval]"=month \
  -d "recurring[trial_period_days]"=14 \
  -d "product_data[name]"="TaskMaster Premium"
```

**Note:** Copy the `price_...` ID from the output - you'll need this for `STRIPE_PRICE_ID`.

### Step 3: Update Customer Portal Configuration

Update your Stripe billing portal configuration with production URLs:

```bash
stripe billing_portal configurations create \
  -d "business_profile[privacy_policy_url]=https://your-production-domain.com/privacy" \
  -d "business_profile[terms_of_service_url]=https://your-production-domain.com/terms" \
  -d "default_return_url=https://your-production-domain.com/profile" \
  -d "features[subscription_cancel][enabled]=true" \
  -d "features[payment_method_update][enabled]=true"
```

**Important:** Replace `your-production-domain.com` with your actual production domain.

### Step 4: Update Environment Variables

- **Frontend (Vercel)**: Update `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` to `pk_live_...`
- **Supabase Secrets**: Update `STRIPE_SECRET_KEY` to `sk_live_...`
- **Supabase Secrets**: Update `STRIPE_PRICE_ID` to your live mode price ID

---

## Updating Webhook Endpoints

### Step 1: Create Production Webhook in Stripe

1. Go to Stripe Dashboard → **Developers → Webhooks** (make sure you're in **Live mode**)
2. Click **Add Endpoint**
3. Enter your production webhook URL:
   ```
   https://[YOUR-PRODUCTION-PROJECT-ID].supabase.co/functions/v1/stripe-webhook
   ```
   Replace `[YOUR-PRODUCTION-PROJECT-ID]` with your actual Supabase project ID.
4. Select these events:
   - `checkout.session.completed`
   - `customer.subscription.deleted`
   - `customer.subscription.updated`
5. Click **Add Endpoint**
6. **Copy the Signing Secret** (`whsec_...`) - you'll need this for `STRIPE_WEBHOOK_SECRET`

### Step 2: Update Supabase Secret

Set the production webhook secret:

```bash
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
```

### Step 3: Verify Webhook Function is Deployed

Make sure your webhook function is deployed to production:

```bash
# Deploy to production project
supabase functions deploy stripe-webhook --project-ref your-production-project-ref
```

### Step 4: Disable JWT Verification (if not already done)

In Supabase Dashboard:
1. Go to **Edge Functions → stripe-webhook**
2. Click **Details**
3. **Disable** "Enforce JWT Verification" (webhooks come directly from Stripe, not authenticated users)

---

## Updating OAuth Redirect URIs

### Step 1: Update Google OAuth Redirect URI

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to **APIs & Services → Credentials**
3. Find your OAuth 2.0 Client ID
4. Click **Edit**
5. Under **Authorized redirect URIs**, add:
   ```
   https://[YOUR-PRODUCTION-PROJECT-ID].supabase.co/auth/v1/callback
   ```
   Replace `[YOUR-PRODUCTION-PROJECT-ID]` with your actual Supabase project ID.
6. Click **Save**

### Step 2: Update Supabase Auth Redirect URLs

1. Go to Supabase Dashboard → **Authentication → URL Configuration**
2. Under **Redirect URLs**, add your production domain:
   ```
   https://your-production-domain.com/**
   ```
   This allows redirects to any path on your production domain.
3. Under **Site URL**, set your production domain:
   ```
   https://your-production-domain.com
   ```
4. Click **Save**

---

## Configuring Supabase CORS and Redirect URLs

### Step 1: Update Site URL

1. Supabase Dashboard → **Authentication → URL Configuration**
2. Set **Site URL** to your production domain:
   ```
   https://your-production-domain.com
   ```

### Step 2: Add Redirect URLs

1. In the same section, under **Redirect URLs**, add:
   ```
   https://your-production-domain.com/**
   ```
   The `**` wildcard allows redirects to any path on your domain.

### Step 3: Verify CORS Settings

Supabase automatically handles CORS for your configured domains. Make sure:
- Your production domain is in the **Redirect URLs** list
- Your **Site URL** matches your production domain

---

## Vercel Deployment Checklist

### Pre-Deployment

- [ ] Production Supabase project created and linked
- [ ] All database migrations applied to production
- [ ] All edge functions deployed to production
- [ ] Production Stripe account set up with live keys
- [ ] Production subscription product created
- [ ] Production webhook endpoint created in Stripe
- [ ] Google OAuth redirect URI updated
- [ ] Supabase redirect URLs configured

### Environment Variables in Vercel

Add these in **Vercel Dashboard → Your Project → Settings → Environment Variables**:

- [ ] `NEXT_PUBLIC_SUPABASE_URL` = `https://your-production-project.supabase.co`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `your-production-anon-key`
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` = `pk_live_...`

### Supabase Secrets

Set these using the Supabase CLI (linked to production project):

- [ ] `STRIPE_SECRET_KEY` = `sk_live_...`
- [ ] `STRIPE_PRICE_ID` = `price_...` (live mode)
- [ ] `STRIPE_WEBHOOK_SECRET` = `whsec_...` (production webhook)
- [ ] `OPENAI_API_KEY` = `sk-...`

### Post-Deployment Testing

After deployment, test these flows:

- [ ] App loads at production URL
- [ ] User can sign up with email/password
- [ ] User can sign in with Google OAuth
- [ ] User can create tasks
- [ ] User can view dashboard
- [ ] User can access profile page
- [ ] User can initiate subscription checkout
- [ ] Stripe checkout completes successfully
- [ ] User subscription status updates correctly
- [ ] User can access billing portal
- [ ] Webhook events are received and processed

### Troubleshooting

**Issue: OAuth redirect fails**
- Check Google OAuth redirect URI matches exactly: `https://[PROJECT-ID].supabase.co/auth/v1/callback`
- Verify Supabase redirect URLs include your production domain

**Issue: Webhook not receiving events**
- Verify webhook URL in Stripe matches: `https://[PROJECT-ID].supabase.co/functions/v1/stripe-webhook`
- Check webhook signing secret matches in Supabase secrets
- Ensure JWT verification is disabled for webhook function

**Issue: Stripe checkout fails**
- Verify `STRIPE_SECRET_KEY` and `STRIPE_PRICE_ID` are set correctly
- Check that price ID is from live mode, not test mode
- Verify `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is set in Vercel

**Issue: CORS errors**
- Verify production domain is in Supabase redirect URLs
- Check that Site URL matches your production domain

---

## Quick Reference: All Production Values Needed

### Frontend (Vercel Environment Variables)
```bash
NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT-ID].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

### Supabase Edge Function Secrets
```bash
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
OPENAI_API_KEY=sk-...
```

### Where to Find Values

| Value | Location |
|-------|----------|
| Supabase URL | Supabase Dashboard → Settings → API → Project URL |
| Supabase Anon Key | Supabase Dashboard → Settings → API → Project API keys → anon/public |
| Stripe Publishable Key | Stripe Dashboard → Developers → API Keys (Live mode) |
| Stripe Secret Key | Stripe Dashboard → Developers → API Keys (Live mode) |
| Stripe Price ID | Stripe Dashboard → Products → Your Product → Pricing |
| Stripe Webhook Secret | Stripe Dashboard → Developers → Webhooks → Your Endpoint → Signing secret |
| OpenAI API Key | platform.openai.com → API Keys |

---

## Additional Notes

- **Never commit production keys to git** - always use environment variables
- **Test thoroughly in production** before announcing to users
- **Monitor Stripe webhook logs** to ensure events are being processed
- **Set up error monitoring** (e.g., Sentry) for production
- **Consider rate limiting** for production API endpoints
- **Update privacy policy and terms URLs** in Stripe billing portal configuration

