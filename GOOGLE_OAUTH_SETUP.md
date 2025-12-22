# Google OAuth Setup Guide

This guide will help you configure Google OAuth authentication for your CtrlChecks AI application.

## Prerequisites

- A Supabase project (already set up)
- A Google Cloud Platform (GCP) account
- Access to your Supabase dashboard

## Step 1: Create Google OAuth Credentials

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/
   - Sign in with your Google account

2. **Create or Select a Project**
   - Click on the project dropdown at the top
   - Click "New Project" or select an existing project
   - Give it a name (e.g., "CtrlChecks AI")
   - Click "Create"

3. **Enable Google+ API**
   - Go to "APIs & Services" > "Library"
   - Search for "Google+ API" or "Google Identity"
   - Click on it and click "Enable"

4. **Create OAuth 2.0 Credentials**
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - If prompted, configure the OAuth consent screen first:
     - **User Type: Choose "External"** ⚠️ **IMPORTANT**
       - **External** = All users with Google accounts can sign in (public access)
       - **Internal** = Only users in your Google Workspace organization can sign in
       - For a public app, you MUST choose "External"
     - App name: "CtrlChecks AI"
     - User support email: Your email
     - Developer contact: Your email
     - Click "Save and Continue"
     - Add scopes: `email`, `profile`, `openid`
     - Click "Save and Continue"
     - **For Testing Phase:**
       - Add test users (your email and any test accounts)
       - These users can sign in immediately without app verification
     - **For Production:**
       - Click "Publish App" to make it available to all users
       - Google may require verification for sensitive scopes (not needed for email/profile)
     - Click "Save and Continue"

5. **Create OAuth Client**
   - Application type: **Web application**
   - Name: "CtrlChecks AI Web"
   - **Authorized JavaScript origins:**
     - Add: `http://localhost:8080` (for local development)
     - Add: `https://yourdomain.com` (for production)
     - Add: `https://your-supabase-project.supabase.co` (your Supabase project URL)
   - **Authorized redirect URIs:**
     - Add: `https://your-supabase-project.supabase.co/auth/v1/callback`
     - Add: `http://localhost:8080/dashboard` (for local testing)
     - Add: `https://yourdomain.com/dashboard` (for production)
   - Click "Create"
   - **Copy the Client ID and Client Secret** (you'll need these)

## Step 2: Configure Supabase

1. **Go to Supabase Dashboard**
   - Visit: https://app.supabase.com/
   - Select your project

2. **Navigate to Authentication**
   - Click "Authentication" in the left sidebar
   - Click "Providers" tab

3. **Enable Google Provider**
   - Find "Google" in the list of providers
   - Toggle it to "Enabled"
   - Enter your **Client ID** (from Google Cloud Console)
   - Enter your **Client Secret** (from Google Cloud Console)
   - Click "Save"

4. **Configure Redirect URLs**
   - Go to "Authentication" > "URL Configuration"
   - Add your site URL: `http://localhost:8080` (for development)
   - Add redirect URLs:
     - `http://localhost:8080/dashboard`
     - `https://yourdomain.com/dashboard` (for production)

## Step 3: Test Google Sign-In

1. **Start your development server**
   ```bash
   npm run dev
   ```

2. **Go to Sign In page**
   - Visit: `http://localhost:8080/signin`
   - Click "Continue with Google"
   - You should be redirected to Google's sign-in page
   - After signing in, you'll be redirected back to your dashboard

## User Access & Roles

### ✅ **All Users Can Access Google Sign-In**

Once configured correctly:
- **Any user with a Google account** can sign in to your app
- No restrictions on who can use Google sign-in
- Users are automatically assigned the **"user" role** by default
- Their profile is created automatically in your database

### User Role Assignment

When a user signs in with Google for the first time:
1. Supabase creates their account automatically
2. A database trigger (`handle_new_user`) runs
3. A profile is created in the `profiles` table
4. A default role of **"user"** is assigned in the `user_roles` table

### Making Users Admin

To make a Google-signed-in user an admin:
1. Go to your Supabase Dashboard
2. Navigate to Table Editor > `user_roles`
3. Find the user's `user_id` (from `auth.users` table)
4. Add a new row with their `user_id` and role = `'admin'`

Or use SQL:
```sql
INSERT INTO public.user_roles (user_id, role)
VALUES ('user-uuid-here', 'admin');
```

### Testing vs Production Access

**During Testing (Unpublished App):**
- Only test users you add can sign in
- Add test users in OAuth consent screen configuration

**After Publishing (Production):**
- **ALL users with Google accounts can sign in**
- No need to add individual users
- App is publicly accessible

## Troubleshooting

### Error: "OAuth provider not enabled"
- **Solution**: Make sure Google provider is enabled in Supabase Dashboard > Authentication > Providers

### Error: "redirect_uri_mismatch"
- **Solution**: 
  - Check that your redirect URI in Google Cloud Console matches exactly: `https://your-supabase-project.supabase.co/auth/v1/callback`
  - Make sure there are no trailing slashes or extra characters

### Error: "invalid_client"
- **Solution**: 
  - Verify your Client ID and Client Secret are correct in Supabase
  - Make sure you copied them correctly (no extra spaces)

### Button doesn't do anything / No redirect
- **Solution**:
  - Open browser console (F12) and check for errors
  - Verify Google provider is enabled in Supabase
  - Check that your Supabase project URL is correct
  - Make sure you're using the correct environment variables

### Works locally but not in production
- **Solution**:
  - Add your production domain to Google Cloud Console authorized origins
  - Update Supabase URL Configuration with production URLs
  - Make sure your production domain matches exactly

## Production Checklist

- [ ] Google OAuth credentials created in Google Cloud Console
- [ ] OAuth consent screen configured with **"External" user type**
- [ ] OAuth consent screen **published** (for public access)
- [ ] Authorized JavaScript origins include production domain
- [ ] Authorized redirect URIs include Supabase callback URL
- [ ] Google provider enabled in Supabase
- [ ] Client ID and Secret added to Supabase
- [ ] Production URLs added to Supabase URL Configuration
- [ ] Tested sign-in flow end-to-end
- [ ] Verified users can sign in and are assigned default "user" role

## Security Notes

- **Never commit** your Client Secret to version control
- Use environment variables for sensitive data
- Regularly rotate your OAuth credentials
- Monitor OAuth usage in Google Cloud Console
- Set up proper CORS policies for production

## Additional Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Supabase Auth Providers](https://supabase.com/docs/guides/auth/social-login)

