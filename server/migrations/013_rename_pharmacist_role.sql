-- The system now runs supermarkets: the Pharmacist role became the Inventory Officer
update users set role = 'inventory_officer' where role = 'pharmacist';
update account_role_changes set from_role = 'inventory_officer' where from_role = 'pharmacist';
update account_role_changes set to_role = 'inventory_officer' where to_role = 'pharmacist';
