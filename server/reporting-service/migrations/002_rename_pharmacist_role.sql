-- The Pharmacist role became the Inventory Officer: old audit entries show the new role name too
update audit_logs set user_role = 'inventory_officer' where user_role = 'pharmacist';
