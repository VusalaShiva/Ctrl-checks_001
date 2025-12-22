# Quick Fix: Error 403: access_denied for Google Sheets

## The Problem

You're seeing this error:
```
nvrrqvlqnnvlihtlgmzn.supabase.co has not completed the Google verification process.
The app is currently being tested, and can only be accessed by developer-approved testers.
Error 403: access_denied
```

This happens because your Google OAuth app is in **Testing mode**, which only allows approved test users.

## Quick Fix (2 minutes)

### Step 1: Go to Google Cloud Console
1. Open: https://console.cloud.google.com/
2. Select your project (or the project where you created the OAuth credentials)

### Step 2: Open OAuth Consent Screen
1. Click **"APIs & Services"** in the left menu
2. Click **"OAuth consent screen"**

### Step 3: Add Yourself as a Test User
1. Scroll down to the **"Test users"** section
2. Click **"+ ADD USERS"** button
3. Enter your **Google account email** (the one you're using to sign in)
4. Click **"ADD"**
5. **Wait 1-2 minutes** for the changes to propagate

### Step 4: Try Again
1. Go back to your app
2. Click **"Connect Google Account"** in the Google Sheets node
3. Sign in with the email you just added
4. You should now be able to connect! ✅

## Alternative: Publish Your App

If you want **all users** to access your app (not just test users):

1. In the OAuth consent screen, click **"PUBLISH APP"** button at the top
2. Confirm the publishing
3. **Note**: Publishing makes your app available to all Google users without needing to add them as test users
4. For most apps, publishing doesn't require verification for Google Sheets scopes

## Verification Requirements

**You DON'T need verification for:**
- ✅ Google Sheets read-only access
- ✅ Google Sheets read/write access (for your own sheets)

**You MIGHT need verification for:**
- ⚠️ Apps with many users (>100)
- ⚠️ Sensitive scopes (Gmail, Drive, etc.)

## Still Not Working?

1. **Make sure you're using the correct Google account** - Use the exact email you added as a test user
2. **Wait a few minutes** - Changes can take 1-5 minutes to propagate
3. **Clear your browser cache** - Sometimes OAuth state gets cached
4. **Disconnect and reconnect** - Click "Disconnect" then "Connect Google Account" again
5. **Check your OAuth client settings** - Make sure your redirect URI includes: `https://your-supabase-project.supabase.co/auth/v1/callback`

## Need Help?

See the full guide: `GOOGLE_SHEETS_SETUP.md` section 1.2.1

