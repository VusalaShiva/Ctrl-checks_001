# Quick Setup Instructions

## Database Setup (3 Steps)

### Step 1: Database Schema
Run `DATABASE_SETUP.sql` in Supabase SQL Editor
- Creates all tables, enums, functions, triggers, and RLS policies
- **Run this FIRST**

### Step 2: Admin User
Run `ADMIN_SETUP.sql` in Supabase SQL Editor
- Follow instructions in the file to set up your admin account
- Replace `'your-email@example.com'` with your actual email
- **Required for admin access**

### Step 3: Sample Templates (Optional)
Run `SAMPLE_DATA.sql` in Supabase SQL Editor
- Inserts 10 pre-built workflow templates
- Templates will be visible to all users
- **Optional but recommended**

## File Structure

- `DATABASE_SETUP.sql` - Complete database schema and security
- `ADMIN_SETUP.sql` - Admin user setup with instructions
- `SAMPLE_DATA.sql` - Pre-built workflow templates
- `README.md` - Full setup guide
- `PROJECT_OVERVIEW.md` - Complete project documentation

## That's It!

After running these 3 SQL files, your database is ready. Start the app and log in!

