# Google Sheets Node Setup Guide

This guide will help you set up and use the Google Sheets node in your CtrlChecks AI workflows.

## Overview

The Google Sheets node allows you to:
- **Read** data from Google Sheets
- **Write** data to Google Sheets (Admin only)
- **Append** rows to Google Sheets (Admin only)
- **Update** existing cells in Google Sheets (Admin only)

## Prerequisites

1. A Google account with access to Google Sheets
2. Admin access to configure Google OAuth (for write operations)
3. A Google Cloud Project with OAuth credentials

## Step 1: Configure Google OAuth

### 1.1 Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Google Sheets API**:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Sheets API"
   - Click "Enable"

### 1.2 Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. Configure OAuth consent screen (if not done):
   - User Type: **External** (for public access)
   - App name: "CtrlChecks AI"
   - Scopes: Add `https://www.googleapis.com/auth/spreadsheets.readonly` and `https://www.googleapis.com/auth/spreadsheets`
   - **⚠️ IMPORTANT: Add Test Users**
     - Scroll down to the "Test users" section
     - Click "+ ADD USERS"
     - Add your Google account email address (and any other users who need access)
     - Click "ADD"
     - **Without test users, you'll get Error 403: access_denied**
4. Create OAuth client:
   - Application type: **Web application**
   - Authorized JavaScript origins:
     - `http://localhost:8080` (for development)
     - `https://yourdomain.com` (for production)
     - `https://your-supabase-project.supabase.co`
   - Authorized redirect URIs:
     - `https://your-supabase-project.supabase.co/auth/v1/callback`
     - `http://localhost:8080/auth/google/callback` (for development)
5. **Copy the Client ID and Client Secret**

### 1.2.1 Fixing "Error 403: access_denied" 

If you're getting this error:
```
nvrrqvlqnnvlihtlgmzn.supabase.co has not completed the Google verification process.
The app is currently being tested, and can only be accessed by developer-approved testers.
```

**Solution:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** > **OAuth consent screen**
3. Scroll down to the **"Test users"** section
4. Click **"+ ADD USERS"**
5. Add your Google account email (the one you're trying to sign in with)
6. Click **"ADD"**
7. Try connecting again in your app

**Alternative: Publish Your App (for production)**
- Click **"PUBLISH APP"** at the top of the OAuth consent screen
- This makes your app available to all Google users (no test user restrictions)
- Note: Publishing may require verification for sensitive scopes, but Google Sheets scopes are usually fine

### 1.3 Configure Supabase Environment Variables

Add these to your Supabase project settings (Edge Functions environment variables):

```
GOOGLE_OAUTH_CLIENT_ID=your-client-id-here
GOOGLE_OAUTH_CLIENT_SECRET=your-client-secret-here
```

## Step 2: Run Database Migration

Run the migration to create the `google_oauth_tokens` table:

```bash
supabase migration up
```

Or apply the migration file:
`supabase/migrations/20250119000000_add_google_oauth_tokens.sql`

## Step 3: Authenticate with Google

1. **Add Google Sheets Node** to your workflow
2. **Click on the node** to open settings
3. **Click "Connect Google Account"**
4. **Authorize** the application to access Google Sheets
5. You'll be redirected back and see "Connected to Google"

## Step 4: Configure the Node

### Basic Configuration

- **Operation**: Choose Read, Write, Append, or Update
- **Spreadsheet ID**: Get from Google Sheets URL
  - URL format: `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`
  - Copy the `SPREADSHEET_ID` part
- **Sheet Name**: Optional - name of the tab (e.g., "Sheet1")
- **Range**: Optional - cell range (e.g., "A1:D100")
  - Leave empty to read all used cells

### Read Operations

- **Output Format**:
  - **JSON Array**: Returns raw array of arrays
  - **Key-Value Pairs**: First row as headers, rest as objects
  - **Plain Text Table**: Tab-separated text format
- **Read Direction**:
  - **Row-wise**: Read horizontally (default)
  - **Column-wise**: Read vertically

### Write Operations (Admin Only)

- **Data Format**: JSON 2D array
  ```json
  [
    ["Header1", "Header2"],
    ["Value1", "Value2"],
    ["Value3", "Value4"]
  ]
  ```
- **Allow Write Access**: Toggle (Admin only)
- **Range**: Target range for write/update operations

## Usage Examples

### Example 1: Read Data and Analyze with AI

```
Manual Trigger → Google Sheets (Read) → OpenAI GPT → Slack Message
```

**Google Sheets Config:**
- Operation: Read
- Spreadsheet ID: `1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms`
- Output Format: Key-Value Pairs

**OpenAI GPT Config:**
- Prompt: "Analyze the data from the sheet and identify any trends or issues."

**Output**: AI analyzes the sheet data and sends insights to Slack

### Example 2: Read and Filter Data

```
Webhook → Google Sheets (Read) → Filter → HTTP POST
```

**Google Sheets Config:**
- Operation: Read
- Output Format: Key-Value Pairs

**Filter Config:**
- Array: `{{input.data}}`
- Condition: `item.Status === "Active"`

**Output**: Only active items are sent to the API

### Example 3: Append New Data (Admin)

```
Webhook → Google Sheets (Append) → Email Notification
```

**Google Sheets Config:**
- Operation: Append
- Allow Write Access: ✅ (Admin only)
- Data: `[["{{input.name}}", "{{input.email}}", "{{input.status}}"]]`

**Output**: New row added to sheet, email sent

## AI Agent Capabilities

When Google Sheets data is passed to AI nodes, the agent can:

✅ **Read and Analyze**: Understand data structure and content  
✅ **Validate**: Check for missing or invalid data  
✅ **Filter**: Identify records matching criteria  
✅ **Calculate**: Perform calculations on numeric data  
✅ **Summarize**: Generate summaries of sheet data  
✅ **Make Decisions**: Use sheet data to make workflow decisions  

## Troubleshooting

### "No Google OAuth token found"

**Solution**: Click "Connect Google Account" in the node settings

### "Permission denied" or "Error 403: access_denied"

**Solution**: 
- **If you see "app is currently being tested"**: Add yourself as a test user in Google Cloud Console OAuth consent screen (see section 1.2.1 above)
- Make sure you have access to the spreadsheet
- Share the spreadsheet with the Google account you authenticated with
- For write operations, ensure you have edit permissions

### "Spreadsheet not found"

**Solution**:
- Check the Spreadsheet ID is correct
- Verify the spreadsheet exists and is accessible
- Make sure the ID is from the URL: `/d/SPREADSHEET_ID/edit`

### "Write access requires admin privileges"

**Solution**:
- Only admins can enable write operations
- Contact an admin to enable "Allow Write Access" toggle
- Or request admin role for your account

### Token Expired

**Solution**: 
- The system will automatically refresh tokens
- If refresh fails, disconnect and reconnect your Google account

## Security Notes

- ✅ OAuth tokens are stored securely in the database
- ✅ Tokens are encrypted and only accessible by the user
- ✅ Write operations require admin privileges
- ✅ All API calls use HTTPS
- ✅ Tokens are automatically refreshed when expired

## API Scopes

The node requests these Google API scopes:
- `https://www.googleapis.com/auth/spreadsheets.readonly` - Read access
- `https://www.googleapis.com/auth/spreadsheets` - Read/Write access (for write operations)

## Best Practices

1. **Use specific ranges** when possible (faster than reading entire sheet)
2. **Use Key-Value format** for easier AI processing
3. **Test with Read** before enabling Write operations
4. **Monitor token expiration** - reconnect if needed
5. **Use Filter nodes** to process large datasets efficiently

## Support

For issues or questions:
1. Check the browser console for detailed error messages
2. Verify Google OAuth is configured correctly
3. Ensure database migration has been applied
4. Check Supabase environment variables are set

