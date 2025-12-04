# Fix: All Auth Redirects Going to Localhost

## The Problem

Both Google OAuth and email/password login are redirecting to localhost. This is because your **production Supabase project** has its Site URL and Redirect URLs still configured for localhost.

## The Solution

You need to update your **production Supabase project** settings (not the local config file).

### Step 1: Find Your Vercel Domain

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Your domain will be shown - it's either:
   - `your-project-name.vercel.app` (default)
   - Your custom domain if you set one up

**Or just check the URL bar when you visit your deployed app!**

### Step 2: Update Supabase Production Settings

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. **Select your PRODUCTION project** (not local)
3. Navigate to **Authentication** → **URL Configuration**
4. Update these two settings:

   **Site URL:**
   ```
   https://your-vercel-domain.vercel.app
   ```
   (Replace with your actual Vercel domain)

   **Redirect URLs:**
   Add this line:
   ```
   https://your-vercel-domain.vercel.app/**
   ```
   The `**` wildcard allows redirects to any path on your domain.

5. Click **Save**

### Step 3: Verify

After saving, try logging in again on your Vercel deployment. Both Google OAuth and email/password should now redirect correctly.

---

## Why This Happens

- Your code uses `window.location.origin` which is correct
- But Supabase has a **whitelist** of allowed redirect URLs
- If your production domain isn't in that whitelist, Supabase redirects to the Site URL (which is still localhost)
- This affects ALL authentication methods, not just OAuth

---

## Quick Checklist

- [ ] Found Vercel domain: `_________________`
- [ ] Updated Supabase Site URL to Vercel domain
- [ ] Added Vercel domain to Redirect URLs with `/**` wildcard
- [ ] Tested Google login on production
- [ ] Tested email/password login on production

---

## Still Having Issues?

If it still redirects to localhost after updating:

1. **Clear your browser cache** - old redirect URLs might be cached
2. **Check you're editing the PRODUCTION project** - make sure you're not editing local dev settings
3. **Wait a few minutes** - Supabase settings can take a moment to propagate
4. **Check the exact domain** - make sure there are no typos (http vs https, trailing slashes, etc.)

