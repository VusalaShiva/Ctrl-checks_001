# CtrlChecks AI - Complete Project Overview

## 🎯 What is CtrlChecks?

**CtrlChecks** (also known as Flow Genius AI) is an **AI-native workflow automation platform** that enables users to visually build, manage, and execute automated workflows without coding. Think of it as a combination of **Zapier**, **n8n**, and **Make.com**, but built from the ground up with AI capabilities integrated into every workflow node.

### Core Value Proposition
> **"Build automations that think. Connect anything. Automate everything."**

---

## 🚀 What the Project Does

### For End Users:
1. **Visual Workflow Builder**: Drag-and-drop interface to create automation workflows
2. **AI-Powered Nodes**: Integrate OpenAI GPT, Anthropic Claude, Google Gemini directly in workflows
3. **Multiple Triggers**: Start workflows via webhooks, schedules, or manual execution
4. **Real-time Execution**: Monitor workflow execution with live logs and progress tracking
5. **Template Library**: Browse and copy pre-built workflow templates
6. **Team Collaboration**: Share workflows with team members (future feature)

### For Administrators:
1. **Template Management**: Create, edit, and manage global workflow templates
2. **User Management**: View and manage user accounts
3. **System Monitoring**: Track platform usage and analytics
4. **Content Control**: Control which templates are visible to users

---

## 🏗️ Project Architecture

### **Frontend (React + TypeScript)**
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **UI Library**: Shadcn/ui components + Tailwind CSS
- **State Management**: Zustand (for workflow state)
- **Routing**: React Router v6
- **Workflow Builder**: React Flow (@xyflow/react)
- **Forms**: React Hook Form + Zod validation
- **Styling**: Tailwind CSS with custom theme

### **Backend (Supabase)**
- **Database**: PostgreSQL (via Supabase)
- **Authentication**: Supabase Auth
- **API**: Supabase Edge Functions (Deno runtime)
- **Real-time**: Supabase Realtime subscriptions
- **Storage**: Supabase Storage (for future file uploads)
- **Security**: Row Level Security (RLS) policies

### **Key Technologies**
- **React Flow**: Visual workflow canvas with nodes and edges
- **Supabase**: Backend-as-a-Service (database, auth, functions)
- **Deno**: Runtime for Edge Functions
- **Zustand**: Lightweight state management
- **TypeScript**: Type-safe development

---

## 📦 Project Structure

```
flow-genius-ai-main/
├── src/
│   ├── pages/              # Main application pages
│   │   ├── Dashboard.tsx   # User dashboard
│   │   ├── Workflows.tsx   # Workflow list
│   │   ├── WorkflowBuilder.tsx  # Visual workflow editor
│   │   ├── Templates.tsx   # User template browser
│   │   ├── Executions.tsx  # Execution history
│   │   ├── admin/          # Admin-only pages
│   │   │   ├── AdminDashboard.tsx
│   │   │   ├── TemplatesManager.tsx
│   │   │   └── TemplateEditor.tsx
│   │   └── settings/       # User settings pages
│   ├── components/         # Reusable UI components
│   │   ├── workflow/      # Workflow-specific components
│   │   │   ├── WorkflowCanvas.tsx
│   │   │   ├── NodeLibrary.tsx
│   │   │   ├── PropertiesPanel.tsx
│   │   │   ├── ExecutionConsole.tsx
│   │   │   └── nodeTypes.ts
│   │   ├── ui/            # Shadcn UI components
│   │   └── landing/       # Landing page components
│   ├── stores/            # State management
│   │   └── workflowStore.ts
│   ├── lib/               # Utilities and API clients
│   │   ├── api/           # API client functions
│   │   ├── auth.tsx       # Authentication context
│   │   └── roles.ts       # Role-based access control
│   └── hooks/             # Custom React hooks
│
├── supabase/
│   ├── functions/         # Edge Functions (Deno)
│   │   ├── execute-workflow/    # Workflow execution engine
│   │   ├── webhook-trigger/     # Webhook endpoint
│   │   ├── chatbot/             # AI chatbot function
│   │   ├── admin-templates/     # Admin template CRUD
│   │   └── copy-template/      # User template copying
│   └── migrations/        # Database migrations
│
└── test-chatbot/         # Standalone chatbot test page
```

---

## 🔄 Core User Flows

### **1. User Registration & Authentication**
```
Landing Page → Sign Up → Select Role (User/Admin) → Dashboard
```
- Users can sign up as regular users or admins
- Role is stored in database and enforced via RLS policies
- Admin checkbox on login for admin access

### **2. Creating a Workflow**
```
Dashboard → New Workflow → Workflow Builder
  → Drag Nodes → Configure → Connect → Save → Execute
```
- Visual drag-and-drop interface
- 50+ node types available
- Real-time validation and error checking
- Save to user's workflow library

### **3. Using Templates**
```
Templates Page → Browse Templates → Copy Template → Workflow Builder
```
- Users can browse pre-built templates
- One-click copy to personal workflows
- Templates are read-only (users edit their copies)

### **4. Executing Workflows**
```
Workflow Builder → Run Button → Real-time Execution → View Logs
```
- Manual execution from builder
- Webhook-triggered execution
- Scheduled execution (cron)
- Real-time progress tracking

### **5. Admin Template Management**
```
Admin Dashboard → Templates Manager → Create/Edit Template
  → Template Editor → Add Nodes/Edges → Save
```
- Admins create global templates
- Full workflow builder for templates
- Version auto-increments on updates
- Changes don't affect existing user workflows

---

## 🧩 Key Components

### **1. Workflow Builder**
- **Visual Canvas**: React Flow-based drag-and-drop interface
- **Node Library**: 50+ pre-built nodes organized by category
- **Properties Panel**: Configure node settings and parameters
- **Execution Console**: Real-time logs and execution results
- **Save/Run Controls**: Save workflows and execute them

### **2. Node Types**
- **Triggers**: Manual, Webhook, Schedule, HTTP Request
- **AI Nodes**: OpenAI GPT, Anthropic Claude, Google Gemini, Text Summarizer, Sentiment Analyzer
- **Logic**: If/Else, Switch, Loop, Filter
- **Data Processing**: JSON Parser, CSV Processor, Text Formatter, Merge Data
- **Integrations**: HTTP Request, Email (Resend), Discord Webhook
- **Variables**: Set Variable, Get Variable
- **Database**: Read, Write (requires setup)

### **3. Execution Engine**
- **Topological Sort**: Executes nodes in correct dependency order
- **Error Handling**: Retry logic, error propagation, graceful failures
- **Template Variables**: `{{input.property}}` replacement system
- **AI Memory**: Conversation history for AI nodes (configurable per node)
- **Real-time Logging**: Live execution logs with node-by-node details

### **4. Template System**
- **Global Templates**: Admin-created, visible to all users
- **Version Control**: Auto-incrementing versions, no auto-updates
- **Metadata**: Name, description, category, difficulty, tags
- **Workflow Structure**: Nodes and edges stored as JSONB
- **Copy Mechanism**: Users copy templates to personal workflows

### **5. Authentication & Authorization**
- **Supabase Auth**: Email/password authentication
- **Role-Based Access**: Admin, Moderator, User roles
- **RLS Policies**: Database-level security
- **Protected Routes**: Admin routes require admin role

---

## 💾 Database Structure

### **Core Tables**

#### **profiles**
- User profile information (name, email, avatar)
- Linked to Supabase Auth users

#### **user_roles**
- Role assignments (admin, moderator, user)
- Enforces role-based access control

#### **workflows**
- User-created workflows
- Stores nodes, edges, metadata
- Links to templates if copied from one

#### **templates**
- Global workflow templates
- Admin-managed, version-controlled
- Read-only for regular users

#### **executions**
- Workflow execution records
- Status, logs, input/output
- Real-time updates via Supabase Realtime

#### **teams** (Future)
- Team collaboration
- Shared workflows
- Team permissions

---

## 🔐 Security Features

### **Row Level Security (RLS)**
- Users can only access their own workflows
- Admins can access all templates
- Users can only view active templates
- Execution logs are user-scoped

### **API Security**
- JWT-based authentication
- Role verification on Edge Functions
- Service role key for internal operations
- CORS protection

### **Data Protection**
- Encrypted connections (HTTPS)
- Secure password hashing (Supabase Auth)
- API key management (user-provided keys)

---

## 🤖 AI Integration

### **Supported AI Models**
1. **OpenAI GPT**: GPT-3.5, GPT-4
2. **Anthropic Claude**: Claude 3 models
3. **Google Gemini**: Gemini Pro, Gemini Ultra

### **AI Features**
- **Conversation Memory**: Configurable memory per AI node (default: 10 turns)
- **System Prompts**: Customizable system instructions
- **Template Variables**: Dynamic prompt generation
- **Error Handling**: Graceful fallbacks for API failures

### **Chatbot**
- Pre-login website chatbot ("chichu")
- Knowledge base-driven responses
- Escalation triggers for complex queries
- Friendly, non-salesy personality

---

## 📊 Workflow Execution Flow

```
1. User Triggers Workflow
   ↓
2. Execution Record Created (status: pending)
   ↓
3. Topological Sort (determine execution order)
   ↓
4. Execute Nodes Sequentially
   ├─ Extract input from upstream nodes
   ├─ Replace template variables
   ├─ Execute node logic
   ├─ Handle errors/retries
   └─ Update execution logs
   ↓
5. Final Output Generated
   ↓
6. Execution Record Updated (status: success/failed)
   ↓
7. Real-time UI Update (via Supabase Realtime)
```

---

## 🎨 UI/UX Features

### **Design System**
- **Shadcn/ui**: Modern, accessible component library
- **Tailwind CSS**: Utility-first styling
- **Dark Mode**: Theme switching support
- **Responsive**: Mobile-friendly layouts

### **User Experience**
- **Real-time Updates**: Live execution logs
- **Drag & Drop**: Intuitive workflow building
- **Visual Feedback**: Loading states, error messages
- **Keyboard Shortcuts**: Power user features
- **Auto-save**: (Future feature)

---

## 🔧 Admin Features

### **Template Management**
- Create templates with full workflow builder
- Edit template metadata and workflow structure
- Toggle active/inactive status
- Delete templates (soft delete if in use)
- Version tracking

### **User Management** (Future)
- View all users
- Manage user roles
- View user activity

### **Analytics** (Future)
- Platform usage statistics
- Template popularity
- Execution metrics

---

## 📝 Key Features Summary

### ✅ **Implemented**
- Visual workflow builder
- 50+ node types
- AI integration (OpenAI, Claude, Gemini)
- Webhook triggers
- Template system
- Real-time execution logs
- Role-based access control
- Admin template management
- User authentication
- Workflow execution engine
- Error handling & retries
- Template variables
- AI conversation memory

### 🚧 **In Progress / Future**
- Scheduled workflows (cron)
- Team collaboration
- Workflow versioning UI
- Export/import workflows
- More integrations
- Mobile app
- Workflow marketplace

---

## 🛠️ Development Setup

### **Prerequisites**
- Node.js 18+
- Supabase account
- Git

### **Quick Start**
1. Clone repository
2. Install dependencies: `npm install`
3. Set up Supabase project
4. Configure `.env` file
5. Run migrations
6. Start dev server: `npm run dev`

### **Environment Variables**
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
```

---

## 📚 Documentation Files

- `README.md` - Setup and installation guide
- `PROJECT_OVERVIEW.md` - This file (complete project overview)
- `ADMIN_PANEL_GUIDE.md` - Admin features guide
- `TEMPLATE_WORKFLOW_EDITOR_GUIDE.md` - Template editing guide
- `WORKFLOW_TESTING_GUIDE.md` - Testing workflows
- Various SQL migration files

---

## 🎯 Project Goals

### **Primary Goals**
1. **No-Code Automation**: Enable non-technical users to build complex automations
2. **AI-First**: Integrate AI capabilities natively into workflows
3. **User-Friendly**: Intuitive visual interface
4. **Scalable**: Handle thousands of workflows and executions
5. **Secure**: Enterprise-grade security and compliance

### **Target Users**
- **Business Teams**: Marketing, sales, operations
- **Developers**: Quick automation without boilerplate
- **Startups**: Affordable automation solution
- **Enterprises**: Self-hosted option available

---

## 📈 Project Status

**Current Version**: MVP / Beta
**Status**: Active Development
**Production Ready**: Core features complete, additional features in progress

---

## 🤝 Contributing

This is a proprietary project. For questions or issues, contact the development team.

---

**Last Updated**: December 2024
**Project Name**: CtrlChecks AI / Flow Genius AI
**Tagline**: "Build automations that think. Connect anything. Automate everything."

