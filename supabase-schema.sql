-- Run this in your Supabase SQL editor

create table if not exists public.jobs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  user_email text not null,
  job_execution_id text unique not null,
  filename text not null,
  status text not null default 'IN PROGRESS',
  outputs jsonb,
  created_at timestamptz default now(),
  completed_at timestamptz
);

-- Row Level Security
alter table public.jobs enable row level security;

-- Users can only see their own jobs
create policy "Users see own jobs"
  on public.jobs for select
  using (auth.uid() = user_id);

create policy "Users insert own jobs"
  on public.jobs for insert
  with check (auth.uid() = user_id);

create policy "Users update own jobs"
  on public.jobs for update
  using (auth.uid() = user_id);

-- Index for faster queries
create index if not exists jobs_user_id_idx on public.jobs(user_id);
create index if not exists jobs_created_at_idx on public.jobs(created_at desc);
