-- Owner role: sits above super, can control everything and assign any
-- role to any individual employee account.
alter table app_config add column if not exists owner_username text not null default 'owner';
alter table app_config add column if not exists owner_password text not null default 'owner123';

-- Lets the Owner promote/demote any individual employee account
-- (staff/admin/super) instead of everyone being fixed at "staff".
alter table staff_accounts add column if not exists role text not null default 'staff';

-- Custom theme colors, editable from Settings instead of hardcoded.
alter table app_config add column if not exists theme_colors jsonb not null default '{"accent1":"#0F9B8E","accent2":"#3E6ACF","headerStart":"#123C4A","headerEnd":"#1B2B2E"}'::jsonb;
