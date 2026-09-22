-- Safety net: the app reads/writes boxes, kits_per_box, added_by, edited_by,
-- edited_at on fridge_inventory, but the original ADD_FRIDGE_INVENTORY.sql
-- never created them. If they were never added by hand in the Supabase SQL
-- editor either, every insert of a new fridge row fails silently (unknown
-- column), which is why newly added items don't stick.
-- Safe to run even if the columns already exist.
alter table fridge_inventory add column if not exists boxes numeric;
alter table fridge_inventory add column if not exists kits_per_box numeric;
alter table fridge_inventory add column if not exists added_by text not null default '';
alter table fridge_inventory add column if not exists edited_by text;
alter table fridge_inventory add column if not exists edited_at timestamptz;
