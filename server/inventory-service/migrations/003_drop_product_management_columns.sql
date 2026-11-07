-- Product Management was removed: drop the catalog columns it added (no-op on databases that never had them)
drop index if exists products_sku_unique;
drop index if exists products_barcode_unique;
alter table products drop column if exists sku;
alter table products drop column if exists barcode;
alter table products drop column if exists unit;
alter table products drop column if exists reorder_level;
alter table products drop column if exists tracks_expiry;
alter table products drop column if exists is_active;
alter table products drop column if exists created_by;
