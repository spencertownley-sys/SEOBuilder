-- Login and signup throttling (packages/platform/src/ratelimit.ts). One row per counted attempt;
-- key is 'email:<normalized email>' or 'ip:<hashed client IP>' (never a raw IP). Rows older than a
-- day are purged by the scheduler.

create table auth_attempts (
  key text not null,
  created_at timestamptz not null default now()
);
create index auth_attempts_key_time on auth_attempts (key, created_at);
