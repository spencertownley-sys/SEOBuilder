-- Core data model from docs/PRD.md ("System architecture, data sources, data model"), for
-- plain Postgres. Access control lives in packages/platform: every query that reads or
-- writes site data goes through a function that first checks workspace membership.

create extension if not exists pgcrypto;

-- ---------- accounts ----------

create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table sessions (
  token_hash text primary key, -- sha256 of the cookie value; the raw token is never stored
  user_id uuid not null references users on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index on sessions (user_id);

create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan text not null default 'free' check (plan in ('free', 'starter', 'growth', 'agency')),
  seats int not null default 1,
  white_label jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table workspace_members (
  workspace_id uuid not null references workspaces on delete cascade,
  user_id uuid not null references users on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  primary key (workspace_id, user_id)
);
create index on workspace_members (user_id);

-- ---------- sites ----------

create table sites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces on delete cascade,
  url text not null, -- start URL for crawls
  domain text not null,
  name text not null,
  aliases text[] not null default '{}',
  verified_at timestamptz,
  verification_token text not null default encode(gen_random_bytes(12), 'hex'),
  business_kind text not null default 'service' check (business_kind in ('service', 'store', 'publisher')),
  business_type text not null default '',
  services text[] not null default '{}',
  locations text[] not null default '{}',
  brand_facts jsonb not null default '{}',
  next_crawl_at timestamptz not null default now(),
  next_prompt_run_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, domain)
);

create table competitors (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites on delete cascade,
  domain text,
  name text not null,
  aliases text[] not null default '{}',
  scores jsonb, -- latest audit scores for side-by-side comparison
  audited_at timestamptz
);
create index on competitors (site_id);

-- Encrypted OAuth tokens (Search Console, GA4) once those integrations land.
create table integrations (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites on delete cascade,
  provider text not null check (provider in ('search_console', 'ga4', 'bing_webmaster', 'google_business_profile')),
  encrypted_token bytea not null,
  property text,
  connected_at timestamptz not null default now(),
  unique (site_id, provider)
);

-- ---------- crawler + audit ----------

create table crawls (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  pages_crawled int not null default 0,
  status text not null default 'running' check (status in ('running', 'done', 'failed')),
  robots jsonb,
  new_issues text[] not null default '{}',
  fixed_issues text[] not null default '{}',
  error text
);
create index on crawls (site_id, started_at desc);

create table pages (
  id uuid primary key default gen_random_uuid(),
  crawl_id uuid not null references crawls on delete cascade,
  url text not null,
  final_url text,
  status_code int,
  title text,
  meta_description text,
  canonical text,
  h1 text[] not null default '{}',
  schema_types text[] not null default '{}',
  word_count int
);
create index on pages (crawl_id);

create table issues (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites on delete cascade,
  type text not null,
  severity text not null check (severity in ('critical', 'warning', 'notice')),
  module text not null check (module in ('seo', 'geo', 'both')),
  urls text[] not null default '{}',
  first_seen timestamptz not null default now(),
  resolved_at timestamptz
);
create unique index issues_open_type on issues (site_id, type) where resolved_at is null;

-- ---------- keywords + rankings (awaiting a data provider) ----------

create table keywords (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites on delete cascade,
  term text not null,
  location text,
  device text not null default 'desktop' check (device in ('desktop', 'mobile')),
  volume int,
  difficulty int
);

create table rank_snapshots (
  keyword_id uuid not null references keywords on delete cascade,
  date date not null,
  position int,
  url text,
  serp_features text[] not null default '{}',
  primary key (keyword_id, date)
);

-- ---------- GEO / AI visibility ----------

create table prompts (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites on delete cascade,
  text text not null,
  intent text not null check (intent in ('discovery', 'comparison', 'how-to', 'pricing', 'brand')),
  location text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (site_id, text)
);

create table prompt_runs (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'done', 'failed')),
  engines text[] not null default '{}',
  metrics jsonb, -- VisibilityMetrics overall + byEngine + topSources
  error text
);
create index on prompt_runs (site_id, started_at desc);

create table ai_runs (
  id uuid primary key default gen_random_uuid(),
  prompt_run_id uuid not null references prompt_runs on delete cascade,
  prompt_id uuid references prompts on delete set null,
  prompt_text text not null,
  engine text not null,
  model text not null,
  run_at timestamptz not null default now(),
  answer_text text,
  cited_urls text[] not null default '{}',
  error text
);
create index on ai_runs (prompt_run_id);

create table ai_mentions (
  id uuid primary key default gen_random_uuid(),
  ai_run_id uuid not null references ai_runs on delete cascade,
  entity text not null,
  is_brand boolean not null,
  mentioned boolean not null,
  position int,
  cited_urls text[] not null default '{}',
  sentiment text check (sentiment in ('positive', 'neutral', 'negative')),
  fact_errors text[] not null default '{}'
);
create index on ai_mentions (ai_run_id);

-- ---------- action plan + scores ----------

create table tasks (
  id text not null, -- stable per site + issue type (core: taskId)
  site_id uuid not null references sites on delete cascade,
  source text not null check (source in ('audit', 'geo')),
  type text not null,
  module text not null check (module in ('seo', 'geo', 'both')),
  severity text not null check (severity in ('critical', 'warning', 'notice')),
  title text not null,
  why text not null,
  steps text[] not null default '{}',
  urls text[] not null default '{}',
  draft_fix text,
  impact int not null check (impact between 1 and 5),
  effort int not null check (effort between 1 and 5),
  confidence real not null check (confidence between 0 and 1),
  priority real not null,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done', 'ignored')),
  resolved boolean not null default false, -- the last check no longer found the issue
  assignee uuid references users on delete set null,
  updated_at timestamptz not null default now(),
  primary key (site_id, id)
);

create table score_snapshots (
  site_id uuid not null references sites on delete cascade,
  taken_at timestamptz not null default now(),
  technical int,
  search int,
  ai_visibility int,
  ai_readiness int,
  primary key (site_id, taken_at)
);

-- ---------- background jobs ----------

create table jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('public_audit', 'site_crawl', 'prompt_run', 'competitor_audit')),
  payload jsonb not null default '{}',
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed')),
  run_after timestamptz not null default now(),
  attempts int not null default 0,
  locked_at timestamptz,
  progress text,
  result jsonb,
  error text,
  requester_hash text, -- hashed client IP for public audits (rate limiting), never the raw IP
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index jobs_ready on jobs (run_after) where status = 'queued';
create index on jobs (requester_hash, created_at) where kind = 'public_audit';
