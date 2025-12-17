# CtrlChecks - Workflow Automation Platform

A powerful workflow automation platform built with React, TypeScript, and Supabase. Create, manage, and execute automated workflows with a visual node-based builder.

## 🚀 Features

- **Visual Workflow Builder**: Drag-and-drop interface with 50+ node types
- **Real-time Execution**: Live progress tracking and execution logs
- **Team Collaboration**: Share workflows with team members
- **Multiple Triggers**: Manual, webhook, and scheduled execution
- **AI Integration**: Support for OpenAI, Anthropic, and Google AI models
- **Version History**: Track and restore workflow versions

---

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **npm** or **bun** package manager
- **Git** - [Download](https://git-scm.com/)
- **Supabase Account** - [Sign up free](https://supabase.com/)

---

## 🛠️ Local Development Setup

### Step 1: Clone the Repository

```bash
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>
```

### Step 2: Create Your Supabase Project

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Click **"New Project"**
3. Enter a project name (e.g., "ctrlchecks-local")
4. Set a strong database password (save this!)
5. Select your preferred region
6. Click **"Create new project"**
7. Wait for the project to be provisioned (1-2 minutes)

### Step 3: Get Your Supabase Credentials

After your project is created:

1. Go to **Project Settings** → **API**
2. Copy these values (you'll need them for the `.env` file):
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon/public key** (starts with `eyJ...`)
   - **Project Reference ID** (the `xxxxx` part from the URL)

### Step 4: Create Environment File

Create a `.env` file in the project root:

```bash
# Create .env file
touch .env
```

Add the following content (replace with your actual values):

```env
# Supabase Configuration
VITE_SUPABASE_URL="https://YOUR_PROJECT_ID.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="your_anon_public_key_here"
VITE_SUPABASE_PROJECT_ID="YOUR_PROJECT_ID"
```

### Step 5: Set Up Database Schema

Go to your Supabase Dashboard → **SQL Editor** and run the following SQL scripts **in order**:

#### 5.1 Complete Database Setup

Run `DATABASE_SETUP.sql` - This creates all tables, enums, functions, triggers, and RLS policies.

#### 5.2 Admin User Setup

Run `ADMIN_SETUP.sql` - This helps you set up an admin user (see file for instructions).

#### 5.3 Sample Data (Optional)

Run `SAMPLE_DATA.sql` - This inserts 10 pre-built workflow templates.

---

**Note**: The old migration files are consolidated into these three files. You only need to run:
1. `DATABASE_SETUP.sql` (required)
2. `ADMIN_SETUP.sql` (required for admin access)
3. `SAMPLE_DATA.sql` (optional - adds templates)

---

**Old Setup Instructions (for reference only):**

#### 5.1 Create Enums

```sql
-- Create custom enum types
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
CREATE TYPE public.execution_status AS ENUM ('pending', 'running', 'success', 'failed', 'cancelled');
CREATE TYPE public.execution_trigger AS ENUM ('manual', 'webhook', 'schedule');
CREATE TYPE public.invitation_status AS ENUM ('pending', 'accepted', 'rejected', 'expired');
CREATE TYPE public.team_role AS ENUM ('owner', 'admin', 'member', 'viewer');
CREATE TYPE public.workflow_status AS ENUM ('draft', 'active', 'paused', 'archived');
```

#### 5.2 Create Tables

```sql
-- Profiles table (user information)
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- User roles table
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Teams table
CREATE TABLE public.teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  owner_id UUID NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Team members table
CREATE TABLE public.team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role team_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(team_id, user_id)
);

-- Team invitations table
CREATE TABLE public.team_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role team_role NOT NULL DEFAULT 'member',
  invited_by UUID NOT NULL,
  token TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
  status invitation_status NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Workflows table
CREATE TABLE public.workflows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  status workflow_status NOT NULL DEFAULT 'draft',
  nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
  edges JSONB NOT NULL DEFAULT '[]'::jsonb,
  viewport JSONB DEFAULT '{"x": 0, "y": 0, "zoom": 1}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  tags TEXT[] DEFAULT '{}'::text[],
  is_public BOOLEAN NOT NULL DEFAULT false,
  is_template BOOLEAN NOT NULL DEFAULT false,
  webhook_url TEXT,
  cron_expression TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Workflow versions table
CREATE TABLE public.workflow_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  nodes JSONB NOT NULL,
  edges JSONB NOT NULL,
  viewport JSONB,
  comment TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(workflow_id, version)
);

-- Executions table
CREATE TABLE public.executions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  user_id UUID,
  status execution_status NOT NULL DEFAULT 'pending',
  trigger execution_trigger NOT NULL DEFAULT 'manual',
  input JSONB,
  output JSONB,
  logs JSONB DEFAULT '[]'::jsonb,
  error TEXT,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  finished_at TIMESTAMP WITH TIME ZONE,
  duration_ms INTEGER
);

-- Templates table
CREATE TABLE public.templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  nodes JSONB NOT NULL,
  edges JSONB NOT NULL,
  preview_image TEXT,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  use_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- API keys table
CREATE TABLE public.api_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  last_used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  link TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
```

#### 5.3 Create Database Functions

```sql
-- Function to check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to check if user is a team member
CREATE OR REPLACE FUNCTION public.is_team_member(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members
    WHERE user_id = _user_id
      AND team_id = _team_id
  )
$$;

-- Function to check if user is a team admin
CREATE OR REPLACE FUNCTION public.is_team_admin(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members
    WHERE user_id = _user_id
      AND team_id = _team_id
      AND role IN ('owner', 'admin')
  )
$$;

-- Function to update updated_at column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    NEW.raw_user_meta_data ->> 'avatar_url'
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;

-- Function to add owner to team
CREATE OR REPLACE FUNCTION public.add_owner_to_team()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.team_members (team_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner');
  RETURN NEW;
END;
$$;
```

#### 5.4 Create Triggers

```sql
-- Trigger for new user registration
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger for auto-adding owner to team
CREATE TRIGGER on_team_created
  AFTER INSERT ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.add_owner_to_team();

-- Triggers for updating updated_at columns
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_workflows_updated_at
  BEFORE UPDATE ON public.workflows
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

#### 5.5 Enable Row Level Security (RLS)

```sql
-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
```

#### 5.6 Create RLS Policies

```sql
-- Profiles policies
CREATE POLICY "Users can view all profiles" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- User roles policies
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- Teams policies
CREATE POLICY "Team members can view team" ON public.teams
  FOR SELECT USING (is_team_member(auth.uid(), id) OR owner_id = auth.uid());

CREATE POLICY "Users can create teams" ON public.teams
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Team admins can update team" ON public.teams
  FOR UPDATE USING (is_team_admin(auth.uid(), id));

CREATE POLICY "Team owner can delete team" ON public.teams
  FOR DELETE USING (auth.uid() = owner_id);

-- Team members policies
CREATE POLICY "Team members can view members" ON public.team_members
  FOR SELECT USING (is_team_member(auth.uid(), team_id));

CREATE POLICY "Team admins can add members" ON public.team_members
  FOR INSERT WITH CHECK (is_team_admin(auth.uid(), team_id));

CREATE POLICY "Team admins can update members" ON public.team_members
  FOR UPDATE USING (is_team_admin(auth.uid(), team_id));

CREATE POLICY "Team admins can remove members" ON public.team_members
  FOR DELETE USING (is_team_admin(auth.uid(), team_id) OR auth.uid() = user_id);

-- Team invitations policies
CREATE POLICY "Team admins can view invitations" ON public.team_invitations
  FOR SELECT USING (is_team_admin(auth.uid(), team_id));

CREATE POLICY "Team admins can create invitations" ON public.team_invitations
  FOR INSERT WITH CHECK (is_team_admin(auth.uid(), team_id));

CREATE POLICY "Team admins can update invitations" ON public.team_invitations
  FOR UPDATE USING (is_team_admin(auth.uid(), team_id));

-- Workflows policies
CREATE POLICY "Users can view own workflows" ON public.workflows
  FOR SELECT USING (
    user_id = auth.uid() OR 
    (team_id IS NOT NULL AND is_team_member(auth.uid(), team_id)) OR 
    is_public = true
  );

CREATE POLICY "Users can create workflows" ON public.workflows
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own workflows" ON public.workflows
  FOR UPDATE USING (
    user_id = auth.uid() OR 
    (team_id IS NOT NULL AND is_team_member(auth.uid(), team_id))
  );

CREATE POLICY "Users can delete own workflows" ON public.workflows
  FOR DELETE USING (user_id = auth.uid());

-- Workflow versions policies
CREATE POLICY "Users can view workflow versions" ON public.workflow_versions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workflows w
      WHERE w.id = workflow_versions.workflow_id
      AND (w.user_id = auth.uid() OR is_team_member(auth.uid(), w.team_id))
    )
  );

CREATE POLICY "Users can create workflow versions" ON public.workflow_versions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM workflows w
      WHERE w.id = workflow_versions.workflow_id
      AND (w.user_id = auth.uid() OR is_team_member(auth.uid(), w.team_id))
    )
  );

-- Executions policies
CREATE POLICY "Users can view own executions" ON public.executions
  FOR SELECT USING (
    user_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM workflows w
      WHERE w.id = executions.workflow_id
      AND (w.user_id = auth.uid() OR is_team_member(auth.uid(), w.team_id))
    )
  );

CREATE POLICY "Users can create executions" ON public.executions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own executions" ON public.executions
  FOR UPDATE USING (user_id = auth.uid());

-- Templates policies
CREATE POLICY "Anyone can view templates" ON public.templates
  FOR SELECT USING (true);

CREATE POLICY "Admins can create templates" ON public.templates
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update templates" ON public.templates
  FOR UPDATE USING (has_role(auth.uid(), 'admin'));

-- API keys policies
CREATE POLICY "Users can view own API keys" ON public.api_keys
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create API keys" ON public.api_keys
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own API keys" ON public.api_keys
  FOR DELETE USING (auth.uid() = user_id);

-- Notifications policies
CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);
```

#### 5.7 Enable Realtime for Executions

```sql
-- Enable realtime for live execution updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.executions;
```

### Step 6: Configure Authentication

1. Go to **Authentication** → **Providers**
2. Enable **Email** provider
3. Go to **Authentication** → **Email Templates** (optional - customize emails)
4. Go to **Authentication** → **URL Configuration**:
   - Set **Site URL** to `http://localhost:8080` (or your local dev URL)
   - Add redirect URLs:
     - `http://localhost:8080`
     - `http://localhost:8080/*`

### Step 7: Set Up Edge Functions (Optional)

If you want to use workflow execution and webhook triggers:

1. Install Supabase CLI:
```bash
npm install -g supabase
```

2. Login to Supabase:
```bash
supabase login
```

3. Link your project:
```bash
supabase link --project-ref YOUR_PROJECT_ID
```

4. Deploy edge functions:
```bash
supabase functions deploy execute-workflow
supabase functions deploy webhook-trigger
```

5. Set edge function secrets (for AI integrations):
```bash
# Optional - for AI node functionality
supabase secrets set OPENAI_API_KEY=your_openai_key
supabase secrets set ANTHROPIC_API_KEY=your_anthropic_key
supabase secrets set RESEND_API_KEY=your_resend_key
```

### Step 8: Install Dependencies

```bash
# Using npm
npm install

# Or using bun
bun install
```

### Step 9: Run the Development Server

```bash
# Using npm
npm run dev

# Or using bun
bun run dev
```

The app will be available at `http://localhost:8080`

---

## 📁 Project Structure

```
├── src/
│   ├── components/          # React components
│   │   ├── landing/         # Landing page components
│   │   ├── ui/              # Shadcn UI components
│   │   └── workflow/        # Workflow builder components
│   ├── hooks/               # Custom React hooks
│   ├── integrations/        # Third-party integrations
│   │   └── supabase/        # Supabase client & types
│   ├── lib/                 # Utility functions
│   ├── pages/               # Page components
│   │   └── settings/        # Settings pages
│   └── stores/              # Zustand state stores
├── supabase/
│   ├── functions/           # Edge functions
│   └── config.toml          # Supabase configuration
└── public/                  # Static assets
```

---

## 🔧 Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_SUPABASE_URL` | Your Supabase project URL | Yes |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/public key | Yes |
| `VITE_SUPABASE_PROJECT_ID` | Your Supabase project ID | Yes |

### Edge Function Secrets (set via Supabase CLI)

| Secret | Description | Required |
|--------|-------------|----------|
| `OPENAI_API_KEY` | OpenAI API key for AI nodes | Optional |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude nodes | Optional |
| `GOOGLE_API_KEY` | Google API key for Gemini nodes | Optional |
| `RESEND_API_KEY` | Resend API key for email nodes | Optional |
| `SLACK_WEBHOOK_URL` | Slack webhook for notifications | Optional |
| `DISCORD_WEBHOOK_URL` | Discord webhook for notifications | Optional |

---

## 🧪 Testing the Setup

1. **Test Authentication**:
   - Go to `http://localhost:8080/sign-up`
   - Create a new account
   - Verify you're redirected to the dashboard

2. **Test Workflow Creation**:
   - Click "New Workflow" 
   - Add some nodes from the library
   - Save the workflow
   - Verify it appears in the Workflows page

3. **Test Execution**:
   - Open a workflow
   - Click "Run"
   - Check the execution console for live updates

---

## 🐛 Troubleshooting

### Common Issues

**"Invalid API key" error**
- Double-check your `.env` file values
- Ensure there are no extra spaces or quotes
- Restart the dev server after changing `.env`

**"Row level security policy violation"**
- Ensure you ran all the RLS policy SQL scripts
- Check that you're logged in before performing operations

**"Function not found" when running workflows**
- Deploy edge functions: `supabase functions deploy`
- Check function logs: `supabase functions logs execute-workflow`

**Realtime updates not working**
- Verify you ran the realtime publication SQL
- Check browser console for WebSocket errors

---

## 📚 Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [React Flow Documentation](https://reactflow.dev/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Shadcn/ui Components](https://ui.shadcn.com/)

---

## 📄 License

This project is licensed under the MIT License.
