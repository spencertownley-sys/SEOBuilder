-- Email verification and password reset (packages/platform/src/auth.ts, SB-06).
-- Accounts that existed before this migration are treated as verified so nobody is locked out;
-- every account created afterwards starts unverified.

alter table users add column email_verified_at timestamptz;
update users set email_verified_at = created_at;

create table auth_tokens (
  token_hash text primary key, -- sha256 of the emailed token; the raw token is never stored
  user_id uuid not null references users on delete cascade,
  purpose text not null check (purpose in ('verify', 'reset')),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index on auth_tokens (user_id);
