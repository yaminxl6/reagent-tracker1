-- Adds support for a "Dispensed" transaction action on blood bags.
-- Only adds columns — does not alter or remove anything existing.
alter table blood_bag_transactions add column if not exists patient_name text;
alter table blood_bag_transactions add column if not exists patient_mrn text;
alter table blood_bag_transactions add column if not exists dispensed_department text;
