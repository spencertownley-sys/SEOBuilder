-- One-time cleanup: remove accounts created by automated end-to-end runs against production.
-- They all use e2e<timestamp>@example.com (example.com is reserved, so no real person can own
-- one). Deleting their workspaces cascades to sites, crawls, tasks and scores; deleting the
-- users cascades to sessions and memberships. A workspace shared with any other user is kept.

delete from workspaces w
where exists (
    select 1 from workspace_members m join users u on u.id = m.user_id
    where m.workspace_id = w.id and u.email like 'e2e%@example.com'
  )
  and not exists (
    select 1 from workspace_members m join users u on u.id = m.user_id
    where m.workspace_id = w.id and u.email not like 'e2e%@example.com'
  );

delete from users where email like 'e2e%@example.com';
