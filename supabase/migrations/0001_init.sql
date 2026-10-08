-- Core data model from docs/PRD.md ("System architecture, data sources, data model").
-- Every row hangs off a workspace; row-level security limits each user to workspaces
-- they belong to (PRD: per-workspace isolation). Workers use the service role and
-- bypass RLS.

create extension if not exists pgcrypto;

-- ---------- tenancy ----------

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
  user_id uuid not null references auth.users on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  primary key (workspace_id, user_id)
);

create or replace function is_member(ws uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from workspace_members where workspace_id = ws and user_id = auth.uid());
$$;

-- ---------- sites ----------

create table sites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces on delete cascade,
  domain text not null,
  name text,
  verified boolean not null default false,
  verification_token text not null default encode(gen_random_bytes(16), 'hex'),
  business_type text,
  services text[] not null default '{}',
  locations text[] not null default '{}',
  brand_facts jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (workspace_id, domain)
);

create table competitors (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites on delete cascade,
  domain text,
  name text not null,
  aliases text[] not null default '{}'
);

-- OAuth tokens (Search Console, GA4) are stored encrypted by the app before insert.
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
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed')),
  robots jsonb,
  error text
);

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
  headings jsonb,
  schema_types text[] not null default '{}',
  word_count int,
  cwv jsonb
);
create index on pages (crawl_id);

create table issues (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites on delete cascade,
  page_id uuid references pages on delete set null,
  type text not null,
  severity text not null check (severity in ('critical', 'warning', 'notice')),
  module text not null check (module in ('seo', 'geo', 'both')),
  urls text[] not null default '{}',
  first_seen timestamptz not null default now(),
  resolved_at timestamptz
);
create unique index issues_open_type on issues (site_id, type) where resolved_at is null;

-- ---------- keywords + rankings ----------

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
  active boolean not null default true
);

create table ai_runs (
  id uuid primary key default gen_random_uuid(),
  prompt_id uuid not null references prompts on delete cascade,
  engine text not null,
  model text not null,
  run_at timestamptz not null default now(),
  answer_text text,
  cited_urls text[] not null default '{}',
  error text
);
create index on ai_runs (prompt_id, run_at desc);

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
  source_issue uuid references issues on delete set null,
  type text not null,
  module text not null check (module in ('seo', 'geo', 'both')),
  title text not null,
  why text not null,
  steps text[] not null default '{}',
  draft_fix text,
  impact int not null check (impact between 1 and 5),
  effort int not null check (effort between 1 and 5),
  confidence real not null check (confidence between 0 and 1),
  priority real not null,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done', 'ignored')),
  assignee uuid references auth.users,
  updated_at timestamptz not null default now(),
  primary key (site_id, id)
);

create table score_snapshots (
  site_id uuid not null references sites on delete cascade,
  date date not null,
  technical int,
  search int,
  ai_visibility int,
  ai_readiness int,
  primary key (site_id, date)
);

-- ---------- row-level security ----------

alter table workspaces enable row level security;
alter table workspace_members enable row level security;
alter table sites enable row level security;
alter table competitors enable row level security;
alter table integrations enable row level security;
alter table crawls enable row level security;
alter table pages enable row level security;
alter table issues enable row level security;
alter table keywords enable row level security;
alter table rank_snapshots enable row level security;
alter table prompts enable row level security;
alter table ai_runs enable row level security;
alter table ai_mentions enable row level security;
alter table tasks enable row level security;
alter table score_snapshots enable row level security;

create policy ws_read on workspaces for select using (is_member(id));
create policy ws_members_read on workspace_members for select using (is_member(workspace_id));
create policy sites_rw on sites for all using (is_member(workspace_id)) with check (is_member(workspace_id));

-- Child tables: access follows the parent site.
create or replace function site_member(s uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from sites where id = s and is_member(workspace_id));
$$;

create policy competitors_rw on competitors for all using (site_member(site_id)) with check (site_member(site_id));
-- Tokens are never readable from the client; only workers (service role) touch them.
create policy integrations_none on integrations for select using (false);
create policy crawls_read on crawls for select using (site_member(site_id));
create policy pages_read on pages for select using (exists (select 1 from crawls c where c.id = crawl_id and site_member(c.site_id)));
create policy issues_read on issues for select using (site_member(site_id));
create policy keywords_rw on keywords for all using (site_member(site_id)) with check (site_member(site_id));
create policy ranks_read on rank_snapshots for select using (exists (select 1 from keywords k where k.id = keyword_id and site_member(k.site_id)));
create policy prompts_rw on prompts for all using (site_member(site_id)) with check (site_member(site_id));
create policy ai_runs_read on ai_runs for select using (exists (select 1 from prompts p where p.id = prompt_id and site_member(p.site_id)));
create policy ai_mentions_read on ai_mentions for select using (
  exists (select 1 from ai_runs r join prompts p on p.id = r.prompt_id where r.id = ai_run_id and site_member(p.site_id))
);
create policy tasks_read on tasks for select using (site_member(site_id));
-- Users change status/assignee; workers write the rest.
create policy tasks_update on tasks for update using (site_member(site_id)) with check (site_member(site_id));
create policy scores_read on score_snapshots for select using (site_member(site_id));
revoke update on tasks from authenticated;
grant update (status, assignee, updated_at) on tasks to authenticated;
