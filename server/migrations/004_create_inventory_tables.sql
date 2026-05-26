-- inventory-service owns the catalog and every unit of stock. IF NOT EXISTS everywhere: safe on the Laravel-built
-- database. branch ids (branch-service) and user ids (user-service) are referenced by id only.

-- The product catalog every branch buys, stocks and sells from
create table if not exists products (
  id varchar(20) primary key, -- "MED-101"
  name varchar(255) not null,
  category varchar(120) not null,
  purchase_price numeric(12, 2),
  selling_price numeric(12, 2),
  price_set_by bigint,
  created_at timestamp(0),
  updated_at timestamp(0),
  constraint products_category_name_unique unique (category, name)
);
create index if not exists products_category_index on products (category);

-- Units of each batch at each branch
create table if not exists stock_batches (
  id bigserial primary key,
  branch_id varchar(20) not null,
  product varchar(255) not null,
  product_key varchar(255) not null, -- lower-case name
  category varchar(255) not null,
  med_id varchar(20),
  batch varchar(50) not null,
  expiry_date date,
  received_at timestamp(0),
  units integer not null,
  created_at timestamp(0),
  updated_at timestamp(0),
  constraint stock_batches_branch_id_product_key_batch_unique unique (branch_id, product_key, batch),
  -- the database itself refuses stock below zero, whatever the code does
  constraint stock_batches_units_not_negative check (units >= 0)
);

-- Corrections made on the Inventory screen
create table if not exists stock_adjustments (
  id bigserial primary key,
  branch_id varchar(20) not null,
  product varchar(255) not null,
  batch varchar(50) not null,
  units_before integer not null,
  units_after integer not null,
  expiry_before date,
  expiry_after date,
  adjusted_by bigint,
  created_at timestamp(0) not null
);
create index if not exists stock_adjustments_branch_id_created_at_index on stock_adjustments (branch_id, created_at);

-- Stock sent from one branch to another
create table if not exists stock_transfers (
  id varchar(20) primary key, -- "TRF-00001"
  from_branch_id varchar(20) not null,
  to_branch_id varchar(20) not null,
  category varchar(255) not null,
  product varchar(255) not null,
  med_id varchar(20),
  batch varchar(50) not null,
  received_batch varchar(50),
  expiry_date date,
  qty integer not null,
  status varchar(20) not null default 'in_transit', -- in_transit | received
  sent_by bigint,
  received_by bigint,
  received_at timestamp(0),
  created_at timestamp(0),
  updated_at timestamp(0)
);
create index if not exists stock_transfers_from_branch_id_status_index on stock_transfers (from_branch_id, status);
create index if not exists stock_transfers_to_branch_id_status_index on stock_transfers (to_branch_id, status);

-- Stock written off as damaged
create table if not exists damaged_items (
  id varchar(20) primary key, -- "DMG-00001"
  branch_id varchar(20) not null,
  med_id varchar(20),
  product varchar(255) not null,
  category varchar(255) not null,
  batch varchar(50) not null,
  qty integer not null,
  reason varchar(120) not null,
  loss_value numeric(12, 2) not null,
  damage_date date not null,
  recorded_by bigint,
  created_at timestamp(0),
  updated_at timestamp(0)
);
create index if not exists damaged_items_branch_id_damage_date_index on damaged_items (branch_id, damage_date);

-- Gapless id counters, shared table; this service owns these counters
create table if not exists id_sequences (
  name varchar(40) primary key,
  value bigint not null
);
insert into id_sequences (name, value) values ('stock_transfers', 0), ('damaged_items', 0), ('batches', 0)
on conflict (name) do nothing;
