-- Renames the "Dispensed" blood bag transaction action to "Issued".
-- Updates any existing rows, then widens the check constraint to match.
update blood_bag_transactions set action = 'Issued' where action = 'Dispensed';

alter table blood_bag_transactions drop constraint if exists blood_bag_transactions_action_check;
alter table blood_bag_transactions add constraint blood_bag_transactions_action_check
  check (action in ('Issued', 'Expired', 'Discarded', 'Returned to Blood Bank'));
