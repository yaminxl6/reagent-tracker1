-- Run once in the SQL Editor of this project's Supabase project.
-- Adds a configurable "expiring soon" warning window (was a fixed 30 days
-- in the code before). Safe to re-run.
alter table app_config add column if not exists expiry_warning_days integer not null default 30;
