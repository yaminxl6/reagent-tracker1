-- Adds an expiry date field to blood bag transactions, so the bag's own
-- expiry date can be recorded (and auto-filled from fridge inventory when
-- the bag is a known one).
alter table blood_bag_transactions add column if not exists expiry_date date;
