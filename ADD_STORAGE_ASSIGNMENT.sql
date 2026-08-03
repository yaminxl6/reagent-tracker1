-- Storage Assignment workflow
-- Adds a "status" to reagents (Pending Storage -> Stored) and a dedicated
-- receiving_records table that preserves full receiving history separately
-- from the reagent's current storage location.
-- Does NOT touch blood_bag_transactions or any Blood Bank table.

-- 1. Status column on reagents. Existing rows are backfilled to "Stored"
--    since they already have a fridge_name / are already in inventory.
alter table reagents add column if not exists storage_status text not null default 'Stored';
update reagents set storage_status = 'Stored' where storage_status is null;

alter table reagents add column if not exists assigned_by text;
alter table reagents add column if not exists assigned_at timestamptz;

-- 2. Receiving records: one row per receiving event, independent of where
--    the reagent ends up stored. This is the permanent audit trail requested.
create table if not exists receiving_records (
  id uuid primary key default gen_random_uuid(),
  reagent_id uuid not null references reagents(id) on delete cascade,
  name text not null,
  department text not null,
  device text not null default '',
  lot_number text not null,
  unit text not null,
  quantity_received numeric not null,
  expiry_date date not null,
  received_date date not null default current_date,
  received_by text not null,
  storage_condition text not null default '',
  created_at timestamptz default now()
);

alter table receiving_records enable row level security;
drop policy if exists "allow all receiving_records" on receiving_records;
create policy "allow all receiving_records" on receiving_records for all using (true) with check (true);

-- 3. Migration: for every existing reagent that has no receiving_records
--    row yet, create exactly one from its current inventory data.
--    Never runs twice for the same reagent (guarded by the NOT EXISTS check).
insert into receiving_records (reagent_id, name, department, device, lot_number, unit, quantity_received, expiry_date, received_date, received_by, storage_condition)
select r.id, r.name, r.department, r.device, r.lot_number, r.unit, r.quantity_received, r.expiry_date, r.date_added, r.added_by, coalesce(r.fridge_name, '')
from reagents r
where not exists (select 1 from receiving_records rr where rr.reagent_id = r.id);
