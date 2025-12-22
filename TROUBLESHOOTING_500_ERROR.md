# Troubleshooting 500 Error in generate-workflow Function

## Current Issue
The function is returning a 500 Internal Server Error. Here's how to diagnose and fix it.

## Step 1: Check Supabase Function Logs

1. **Go to**: https://supabase.com/dashboard/project/nvrrqvlqnnvlihtlgmzn
2. **Navigate to**: Edge Functions → `generate-workflow`
3. **Click on**: "Logs" tab
4. **Look for**: Error messages that show what went wrong

Common errors you might see:
- `GEMINI_API_KEY is not configured`
- `Gemini API error: 400/401/403`
- `Failed to parse AI response`
- Any other error messages

## Step 2: Verify Environment Variables

The function requires `GEMINI_API_KEY` to be set:

1. **Go to**: Project Settings → Edge Functions → Secrets
2. **Check if**: `GEMINI_API_KEY` exists
3. **If missing**: Add it with your Google Gemini API key
4. **After adding**: Redeploy the function

### How to Get a Gemini API Key

1. Go to: https://makersuite.google.com/app/apikey
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the key
5. Add it to Supabase secrets

## Step 3: Common Error Causes

### Error: "GEMINI_API_KEY is not configured"
**Solution**: Add the API key in Project Settings → Edge Functions → Secrets

### Error: "Gemini API error: 400"
**Solution**: 
- Check if your API key is valid
- Verify the API key has proper permissions
- Check if you've exceeded API quota

### Error: "Gemini API error: 401"
**Solution**: 
- Your API key is invalid or expired
- Generate a new API key and update it

### Error: "Gemini API error: 403"
**Solution**: 
- API key doesn't have access to Gemini API
- Enable Gemini API in Google Cloud Console
- Check API key permissions

### Error: "Failed to parse AI response"
**Solution**: 
- The AI returned invalid JSON
- This is handled with a fallback workflow
- Check logs for the actual AI response

## Step 4: Test the Function

After fixing the issue:

1. **Redeploy** the function
2. **Test from your app** - try generating a workflow
3. **Check logs again** if it still fails
4. **Verify** the error message in the UI matches the logs

## Step 5: Improved Error Messages

I've updated the function to:
- ✅ Log detailed error information
- ✅ Return more descriptive error messages
- ✅ Handle Gemini API errors gracefully
- ✅ Show specific error messages in the UI

## Next Steps

1. **Check the logs** in Supabase Dashboard
2. **Verify** `GEMINI_API_KEY` is set
3. **Redeploy** the function if you made changes
4. **Test again** from your application

The improved error handling will now show you exactly what went wrong!

