# Deployment Instructions

## Deploying Supabase Edge Functions

### Option 1: Using npm script (Recommended)

From the `Ctrl-checks_001` directory, run:

```powershell
npm run deploy:generate-workflow
```

This will use `npx` to run the Supabase CLI without requiring global installation.

### Option 2: Using npx directly

```powershell
npx supabase functions deploy generate-workflow --project-ref nvrrqvlqnnvlihtlgmzn
```

### Option 3: Using Supabase Dashboard

1. Go to your Supabase project dashboard: https://supabase.com/dashboard/project/nvrrqvlqnnvlihtlgmzn
2. Navigate to **Edge Functions** in the left sidebar
3. Find `generate-workflow` function
4. Click **Deploy** or **Redeploy**

### Option 4: Install Supabase CLI (Alternative)

If you prefer to install the CLI locally, you can use one of these methods:

**Using Scoop (Windows):**
```powershell
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

**Using Chocolatey (Windows):**
```powershell
choco install supabase
```

**Download Binary:**
Visit https://github.com/supabase/cli/releases and download the Windows binary.

After installation, you can deploy with:
```powershell
supabase functions deploy generate-workflow --project-ref nvrrqvlqnnvlihtlgmzn
```

## Authentication

Before deploying, make sure you're logged in:

```powershell
npx supabase login
```

Or if you have the CLI installed:
```powershell
supabase login
```

## Environment Variables

Make sure the following environment variables are set in your Supabase project:
- `GEMINI_API_KEY` - Required for the generate-workflow function

To set environment variables:
1. Go to Supabase Dashboard → Project Settings → Edge Functions
2. Add the secrets there

