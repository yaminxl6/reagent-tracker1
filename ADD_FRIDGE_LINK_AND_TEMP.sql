-- Run once in the SQL Editor (after ADD_FRIDGE_INVENTORY.sql).
-- Adds: (1) a fridge_name link on every reagent lot, so Reports can show
-- which fridge it's stored in, and (2) a fridge temperature log table,
-- so Reports can show the fridge temperature too.

-- 1) Link each reagent lot to a fridge (same free-text pattern as `device`)
alter table reagents add column if not exists fridge_name text not null default '';

-- 2) Temperature readings per fridge, over time. Ready to receive your
-- 2023 → today history — send the data and I'll place each reading here.
create table if not exists fridge_temperature_logs (
  id uuid primary key default gen_random_uuid(),
  fridge_name text not null,
  date date not null,
  temperature numeric not null,
  recorded_by text not null default '',
  note text not null default '',
  created_at timestamptz default now()
);
create index if not exists idx_fridge_temp_name_date on fridge_temperature_logs(fridge_name, date);

alter table fridge_temperature_logs enable row level security;
create policy "allow all fridge_temperature_logs" on fridge_temperature_logs for all using (true) with check (true);

-- 3) Auto-routing: each device (and/or each ready-made item preset) can carry
-- a default fridge, so the Fridge field on Receive fills in by itself based
-- on what you picked — you can always still change it manually per lot
-- (e.g. to "Room Temperature (Warehouse)" for stock that isn't refrigerated).
alter table devices add column if not exists default_fridge_name text not null default '';
alter table reagent_presets add column if not exists default_fridge_name text not null default '';

-- Best-guess starting mapping for your fridges — check/adjust names in
-- Settings → Devices (and → Item presets) since your exact device names in
-- the app may differ slightly from these guesses:
update devices set default_fridge_name = 'R01'
  where default_fridge_name = '' and (name ilike '%vidas%' or name ilike '%cobas%' or name ilike '%biolis%');
update devices set default_fridge_name = 'Lab0202'
  where default_fridge_name = '' and name ilike '%beckman%';
update devices set default_fridge_name = 'R012'
  where default_fridge_name = '' and name ilike '%sysmex%';
update devices set default_fridge_name = 'R0008'
  where default_fridge_name = '' and (name ilike '%urine%' or name ilike '%pt/ptt%' or name ilike '%coag%');
update devices set default_fridge_name = 'R009'
  where default_fridge_name = '' and department ilike '%blood%';
update reagent_presets set default_fridge_name = 'R0008'
  where default_fridge_name = '' and (name ilike '%abo%' or name ilike '%ptt%' or name ilike '% pt %' or name ilike 'pt %' or name ilike '% pt');

