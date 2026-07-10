-- Run once in the SQL Editor. If you already ran the old
-- ADD_FRIDGE_INVENTORY.sql (location_type/location_name/count_date
-- version), run this to replace it with the new layout that matches your
-- paper form (device sections, lot number, fraction-friendly quantity).
drop table if exists fridge_inventory;

create table if not exists fridge_inventory (
  id uuid primary key default gen_random_uuid(),
  month text not null,              -- "07-2026" style, matches the paper form
  refrigerator_name text not null,  -- "Refrigerator: X" on the form
  counted_by text not null default '',
  device_group text not null default '',  -- section header, e.g. "VIDAS"
  item_name text not null,
  lot_number text not null default '',    -- the "Unit" column on the paper form
  quantity text not null default '',      -- free text so "½", "1 1/2" etc. work
  expiry_date date,
  row_order integer not null default 0,
  created_at timestamptz default now()
);
alter table fridge_inventory enable row level security;
create policy "allow all fridge_inventory" on fridge_inventory for all using (true) with check (true);
