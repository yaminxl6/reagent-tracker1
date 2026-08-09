-- Adds support for an "Issued" transaction action on blood bags.
-- Only adds columns — does not alter or remove anything existing.
alter table blood_bag_transactions add column if not exists patient_name text;
alter table blood_bag_transactions add column if not exists patient_mrn text;
alter table blood_bag_transactions add column if not exists dispensed_department text;
alter table blood_bag_transactions add column if not exists component_type text;

-- The table had an existing CHECK constraint on `action` from before this
-- feature that only allowed the original three actions. Widen it to also
-- allow "Issued".
alter table blood_bag_transactions drop constraint if exists blood_bag_transactions_action_check;
alter table blood_bag_transactions add constraint blood_bag_transactions_action_check
  check (action in ('Issued', 'Expired', 'Discarded', 'Returned to Blood Bank'));
