-- Run once in the SQL Editor of this project's Supabase project.
-- Monthly stock counts of what's kept inside fridges/equipment — completely
-- separate from reagents/consumption_logs, so it never shows up in Reports.
create table if not exists fridge_inventory (
  id uuid primary key default gen_random_uuid(),
  location_type text not null default 'Fridge',   -- 'Fridge' or 'Equipment'
  location_name text not null,                     -- e.g. "Fridge 1", "Cobas c311"
  item_name text not null,
  unit text not null default 'unit',
  quantity numeric not null default 0,
  counted_by text not null,
  count_date date not null default current_date,
  created_at timestamptz default now()
);
alter table fridge_inventory enable row level security;
create policy "allow all fridge_inventory" on fridge_inventory for all using (true) with check (true);
