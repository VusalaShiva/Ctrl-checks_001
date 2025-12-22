# Step-by-Step: Deploy generate-workflow Function via Supabase Dashboard

## Prerequisites
- Access to your Supabase project
- The function code is ready in your local files

---

## Step 1: Access Your Supabase Project

1. **Open your web browser** and navigate to:
   ```
   https://supabase.com/dashboard/project/nvrrqvlqnnvlihtlgmzn
   ```

2. **Sign in** if you're not already logged in:
   - Enter your Supabase account credentials
   - Complete any 2FA if required

3. **Verify you're in the correct project**:
   - Check the project name in the top-left corner
   - Should show your project (ID: nvrrqvlqnnvlihtlgmzn)

---

## Step 2: Navigate to Edge Functions

1. **Look at the left sidebar** menu
2. **Find "Edge Functions"** - it's usually under:
   - **"Project"** section, OR
   - **"Develop"** section
3. **Click on "Edge Functions"**
   - This will open the Edge Functions page showing all your functions

---

## Step 3: Locate or Create the Function

### Option A: Function Already Exists

If you see **"generate-workflow"** in the list:

1. **Click on "generate-workflow"** to open it
2. You'll see the function details page
3. **Skip to Step 4**

### Option B: Function Doesn't Exist (Create New)

If you don't see "generate-workflow" in the list:

1. **Click the "Create a new function"** or **"New Function"** button
   - Usually a green button at the top-right
2. **Enter the function name**: `generate-workflow`
   - Make sure it matches exactly (lowercase, hyphen-separated)
3. **Click "Create"** or "Continue"
4. You'll now see an editor or upload interface

---

## Step 4: Upload/Update the Function Code

### If Using the Code Editor:

1. **Delete any existing code** in the editor
2. **Copy the entire contents** of `Ctrl-checks_001/supabase/functions/generate-workflow/index.ts`
3. **Paste it** into the editor
4. **Note**: You may need to handle shared files separately (see Step 5)

### If Using File Upload:

1. **Click "Upload"** or "Choose File"
2. **Navigate to**: `Ctrl-checks_001/supabase/functions/generate-workflow/`
3. **Select**: `index.ts`
4. **Upload the file**

---

## Step 5: Handle Shared Dependencies

The function uses shared files from `_shared/` folder. You have two options:

### Option A: Inline the Shared Code (Simpler)

If the dashboard doesn't support shared files, you'll need to:

1. **Copy the contents** of `_shared/cors.ts` and `_shared/llm-adapter.ts`
2. **Inline them** in the function code (replace imports with actual code)

### Option B: Use CLI (Recommended)

The dashboard may have limitations with shared files. Consider using:
```powershell
npx supabase login
npx supabase functions deploy generate-workflow --project-ref nvrrqvlqnnvlihtlgmzn
```

---

## Step 6: Set Environment Variables

Before deploying, ensure required environment variables are set:

1. **In the Supabase Dashboard**, go to:
   - **Project Settings** (gear icon in left sidebar)
   - **Edge Functions** tab
   - **Secrets** section

2. **Add/Verify these secrets**:
   - `GEMINI_API_KEY` - Your Google Gemini API key (required for workflow generation)

3. **Click "Save"** after adding secrets

---

## Step 7: Deploy the Function

1. **Scroll down** to the bottom of the function page
2. **Click the "Deploy"** or **"Redeploy"** button
   - Usually a green/blue button
   - May say "Deploy Function" or "Save and Deploy"

3. **Wait for deployment**:
   - You'll see a loading indicator
   - Deployment typically takes 30-60 seconds
   - You'll see a success message when complete

---

## Step 8: Verify Deployment

1. **Check the function status**:
   - Should show "Active" or "Deployed"
   - Status indicator should be green

2. **Test the function** (optional):
   - Click "Invoke" or "Test" button
   - Or test from your application

3. **Check logs**:
   - Click on "Logs" tab to see function execution logs
   - Verify there are no errors

---

## Step 9: Verify CORS Configuration

1. **Go to**: Project Settings → Edge Functions
2. **Find**: `generate-workflow` in the function list
3. **Check**: `verify_jwt` setting
   - Should be `false` (as configured in `config.toml`)
   - If different, update it to match

---

## Troubleshooting

### Function Not Appearing
- Refresh the page
- Check you're in the correct project
- Try creating it manually

### Deployment Fails
- Check for syntax errors in the code
- Verify all imports are available
- Check the logs for specific error messages

### CORS Errors Persist
- Ensure the function was redeployed after our code changes
- Clear browser cache
- Check that OPTIONS requests return 200 status

### Missing Environment Variables
- Go to Project Settings → Edge Functions → Secrets
- Add `GEMINI_API_KEY` if missing
- Redeploy the function after adding secrets

---

## Success Indicators

✅ Function shows as "Active" or "Deployed"  
✅ No errors in the logs  
✅ CORS errors are resolved in your application  
✅ Workflow generation works from the UI  

---

## Next Steps After Deployment

1. **Test the function** from your application
2. **Monitor logs** for any issues
3. **Verify** the CORS error is resolved
4. **Check** that workflow generation works end-to-end

