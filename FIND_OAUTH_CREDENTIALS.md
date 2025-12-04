# Finding Your OAuth Configuration Values

This guide will help you find your Supabase Project ID and Vercel domain so you can fix the Google OAuth redirect issue.

## Step 1: Find Your Supabase Project ID

Your Supabase Project ID is the part of your Supabase URL that comes before `.supabase.co`.

### Method 1: From Supabase Dashboard
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your production project
3. Go to **Settings** (gear icon in sidebar) → **API**
4. Look at the **Project URL** - it will look like:
   ```
   https://abcdefghijklmnop.supabase.co
   ```
5. The part `abcdefghijklmnop` is your **Project ID**

### Method 2: From Vercel Environment Variables
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Find `NEXT_PUBLIC_SUPABASE_URL`
5. It will look like: `https://abcdefghijklmnop.supabase.co`
6. The part `abcdefghijklmnop` is your **Project ID**

### Method 3: From Your Browser
1. Visit your deployed app on Vercel
2. Open browser DevTools (F12 or Cmd+Option+I)
3. Go to **Console** tab
4. Type: `process.env.NEXT_PUBLIC_SUPABASE_URL` (if available)
5. Or check the **Network** tab for any Supabase API calls - the URL will show your project ID

---

## Step 2: Find Your Vercel Domain

### Method 1: From Vercel Dashboard
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Look at the **Domains** section or check the deployment URL
4. Your domain will be one of:
   - `your-project-name.vercel.app` (default)
   - `your-custom-domain.com` (if you set one up)

### Method 2: From Your Browser
1. Just look at the URL bar when you visit your deployed app!
2. It will be something like: `https://task-app-project.vercel.app`

### Method 3: From Deployment History
1. Go to Vercel Dashboard → Your Project → **Deployments**
2. Click on any deployment
3. The URL shown is your domain

---

## Step 3: Use These Values

Once you have both values, use them as follows:

### For Google Cloud Console:
Add this redirect URI (replace `[YOUR-PROJECT-ID]` with your actual project ID):
```
https://[YOUR-PROJECT-ID].supabase.co/auth/v1/callback
```

**Example:** If your project ID is `abcdefghijklmnop`, the URL would be:
```
https://abcdefghijklmnop.supabase.co/auth/v1/callback
```

### For Supabase Dashboard:
1. **Site URL:** `https://your-vercel-domain.vercel.app`
2. **Redirect URLs:** `https://your-vercel-domain.vercel.app/**`

**Example:** If your Vercel domain is `task-app-project.vercel.app`:
- Site URL: `https://task-app-project.vercel.app`
- Redirect URLs: `https://task-app-project.vercel.app/**`

---

## Quick Checklist

- [ ] Found Supabase Project ID: `_________________`
- [ ] Found Vercel Domain: `_________________`
- [ ] Added Google OAuth redirect URI: `https://[PROJECT-ID].supabase.co/auth/v1/callback`
- [ ] Updated Supabase Site URL to Vercel domain
- [ ] Added Vercel domain to Supabase Redirect URLs with `/**` wildcard

---

## Still Need Help?

If you're having trouble finding these values:

1. **For Supabase Project ID:** Check your local `.env.local` file (if it exists) - look for `NEXT_PUBLIC_SUPABASE_URL`
2. **For Vercel Domain:** Check your Vercel project settings or just visit your deployed app and look at the URL

