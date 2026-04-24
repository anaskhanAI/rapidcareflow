# RapidCareFlow — AI Medical Coding Platform

Automated ICD-10, CPT, HCPCS, E&M and Modifier extraction powered by Opus AI workflows.

## Stack
- **Next.js 15** (App Router) + TypeScript
- **Tailwind CSS v4** + shadcn-style components
- **Supabase** — Auth (email/password) + PostgreSQL (job history)
- **Opus AI** — Workflow execution via Job Operator API
- **Vercel** — Hosting

---

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run `supabase-schema.sql` in the **SQL Editor**
3. Enable **Email Auth** under Authentication → Providers
4. Copy your Project URL and anon key

### 2. Environment Variables

Update `.env.local` (for local dev) and add these on Vercel:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Opus API (server-side only)
OPUS_SERVICE_KEY=your_opus_service_key
OPUS_WORKFLOW_ID=dNV0rURv2DLN6OMX
OPUS_BASE_URL=https://operator.opus.com
```

**Get your Opus service key:**
- Opus platform → My Organization → Settings → API Keys → Generate

### 3. Local Dev

```bash
npm install
npm run dev
```

### 4. Deploy to Vercel

```bash
vercel deploy
```

Add all env vars in Vercel project settings.

---

## Architecture

```
app/
├── (auth)/login/         — Email/password login (Supabase Auth)
├── (app)/dashboard/      — File upload + live streaming audit UX
├── (app)/jobs/           — Jobs history with parallel polling
├── api/
│   ├── jobs/             — POST: upload PDF → initiate → execute Opus job
│   ├── jobs/[id]/status  — GET: poll job status, update Supabase
│   ├── jobs/[id]/results — GET: fetch outputs, persist to Supabase
│   └── jobs/[id]/audit   — GET: real Opus audit log entries
components/
├── StreamingAudit        — Live terminal-style audit with staged UX messages
├── ResultsPanel          — Displays 7 output categories with confidence score
├── JobCard               — Expandable card with background polling + tabs
└── Navbar                — Navigation + user menu
lib/
├── opus.ts               — Opus API client (server-side only)
├── supabase/             — Browser + server Supabase clients
└── utils.ts              — cn(), formatDate(), formatDuration()
```

## Workflow Mapping

| Opus Output Variable | Display Name | Type |
|---|---|---|
| `workflow_output_oocfcvyvm` | Validated CPT Codes | List |
| `workflow_output_eewcq3j5i` | Validated ICD-10 Codes | List |
| `workflow_output_vog70pb1w` | Validated E&M Codes | List |
| `workflow_output_rhrdp0ct5` | Validated HCPCS Codes | List |
| `workflow_output_mydmzzu29` | Validated Modifiers | List |
| `workflow_output_hc4ibmnpl` | Validated Reasoning | Text |
| `workflow_output_aeekjso7g` | Validated Confidence Score | Number (0–1) |

## Key UX Behaviors

- **Parallel processing** — Users can start a new job while another runs; each job card polls independently in the background
- **Streaming audit** — Combines real Opus audit log entries with staged UX messages that progress on a time schedule
- **Persistent history** — All jobs are stored in Supabase with user attribution (who ran it, when)
- **Auth** — Row-level security ensures each user only sees their own jobs
