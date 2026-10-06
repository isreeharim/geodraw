-- ==============================================================================
-- GeoDraw Database Schema & Row-Level Security (RLS)
-- Blueprint v2 Specification
-- ==============================================================================

-- 1. PROFILES TABLE
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- 2. JOURNEYS TABLE
create table if not exists public.journeys (
  id uuid primary key, -- client-generated UUID
  user_id uuid references auth.users(id) on delete cascade,
  title text not null default 'Untitled Journey',
  status text not null default 'recording' check (status in ('recording', 'completed', 'abandoned')),
  visibility text not null default 'private' check (visibility in ('private', 'unlisted', 'public')),
  share_token text unique,
  travel_mode text not null default 'walk' check (travel_mode in ('walk', 'bike', 'car', 'plane')),
  vehicle text not null default 'walk' check (vehicle in ('walk', 'bike', 'car', 'bus', 'plane')),
  started_at bigint not null,
  ended_at bigint,
  distance_m numeric not null default 0,
  duration_s numeric not null default 0,
  moving_time_s numeric not null default 0,
  raw_track jsonb not null default '[]'::jsonb,
  display_geometry jsonb,
  style jsonb not null default '{"mapStyle":"light","routeStyle":"classic","cameraMode":"follow"}'::jsonb,
  created_at timestamptz default now()
);

-- Indexes for performance
create index if not exists idx_journeys_user_id on public.journeys(user_id);
create index if not exists idx_journeys_share_token on public.journeys(share_token);

alter table public.journeys enable row level security;

-- RLS: Only the owner can select/insert/update/delete their raw journey
create policy "Owners can view own journeys"
  on public.journeys for select
  using (auth.uid() = user_id);

create policy "Owners can insert own journeys"
  on public.journeys for insert
  with check (auth.uid() = user_id);

create policy "Owners can update own journeys"
  on public.journeys for update
  using (auth.uid() = user_id);

create policy "Owners can delete own journeys"
  on public.journeys for delete
  using (auth.uid() = user_id);

-- 3. JOURNEY POINTS TABLE (Batched Idempotent Sync)
create table if not exists public.journey_points (
  journey_id uuid references public.journeys(id) on delete cascade,
  seq integer not null,
  point jsonb not null,
  created_at timestamptz default now(),
  primary key (journey_id, seq)
);

alter table public.journey_points enable row level security;

create policy "Owners can read own journey points"
  on public.journey_points for select
  using (
    exists (
      select 1 from public.journeys
      where journeys.id = journey_points.journey_id
      and journeys.user_id = auth.uid()
    )
  );

create policy "Owners can insert own journey points"
  on public.journey_points for insert
  with check (
    exists (
      select 1 from public.journeys
      where journeys.id = journey_points.journey_id
      and journeys.user_id = auth.uid()
    )
  );

-- 4. JOURNEY PUBLIC TABLE (Privacy-Trimmed View)
-- Only sanitized, privacy-trimmed geometry and stats live here.
-- raw_track is NEVER placed in this table.
create table if not exists public.journey_public (
  journey_id uuid primary key references public.journeys(id) on delete cascade,
  share_token text unique not null,
  title text not null,
  distance_m numeric not null default 0,
  duration_s numeric not null default 0,
  travel_mode text not null,
  vehicle text not null,
  started_at bigint not null,
  display_geometry jsonb not null,
  style jsonb not null,
  created_at timestamptz default now()
);

alter table public.journey_public enable row level security;

-- Public / unlisted readers can view by share_token
create policy "Anyone with share_token can view public journey"
  on public.journey_public for select
  using (true);

create policy "Owners can manage public journey entry"
  on public.journey_public for all
  using (
    exists (
      select 1 from public.journeys
      where journeys.id = journey_public.journey_id
      and journeys.user_id = auth.uid()
    )
  );
