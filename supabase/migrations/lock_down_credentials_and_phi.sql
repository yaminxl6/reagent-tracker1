-- Locks the anon/authenticated (public anon-key) role out of staff
-- credentials, the shared owner/super/admin/lab logins, and patient data
-- in blood_bag_transactions. After this runs, the ONLY way to read or
-- write those is through the `auth` and `blood-bag` edge functions
-- (service-role key, never shipped to the browser).
--
-- *** DO NOT RUN THIS until the new frontend (the one that talks to the
-- `auth`/`blood-bag` edge functions instead of these tables directly) is
-- actually deployed and live. Running it before that will lock every
-- real user out of the app immediately — login, staff management, and
-- Blood Bag Transactions all go through these tables/columns. ***

-- 1. staff_accounts: no more direct anon access at all.
drop policy if exists "allow all staff_accounts" on staff_accounts;

-- 2. blood_bag_transactions: no more direct anon access at all (this table
--    holds patient_name / patient_mrn).
alter table blood_bag_transactions enable row level security;
drop policy if exists "allow all blood_bag_transactions" on blood_bag_transactions;

-- 3. app_config: keep the table itself readable/writable (departments,
--    theme, app name, etc. are still meant to be public-ish config), but
--    revoke column-level access to the 8 credential fields specifically.
--    A bare select("*") from the client must be changed to name columns
--    explicitly once this runs (already done in App.jsx/ensureConfig).
revoke select (owner_username, owner_password, super_username, super_password, admin_username, admin_password, lab_username, lab_password)
  on app_config from anon, authenticated;
revoke update (owner_username, owner_password, super_username, super_password, admin_username, admin_password, lab_username, lab_password)
  on app_config from anon, authenticated;
