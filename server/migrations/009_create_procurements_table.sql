-- procurement-service owns purchase orders and their Chapa payments. IF NOT EXISTS everywhere: safe on the
-- Laravel-built database. branch ids (branch-service) and user ids (user-service) are referenced by id only.

create table if not exists procurements (
  id varchar(20) primary key, -- "PO-00001"
  branch_id varchar(20) not null,
  created_by bigint,
  supplier varchar(255) not null,
  category varchar(255) not null,
  product varchar(255) not null,
  med_id varchar(20),
  qty integer not null,
  unit_price numeric(12, 2) not null,
  total numeric(12, 2) not null,
  currency varchar(3) not null,
  status varchar(20) not null default 'pending', -- pending | paid | failed
  tx_ref varchar(64) not null constraint procurements_tx_ref_unique unique,
  checkout_url text,
  chapa_reference varchar(255),
  payment_method varchar(255),
  paid_at timestamp(0),
  -- stock enters the branch only when its Inventory Officer adds it, under a generated batch number
  received_at timestamp(0),
  received_by bigint,
  batch varchar(50),
  expiry_date date,
  created_at timestamp(0),
  updated_at timestamp(0)
);
create index if not exists procurements_branch_id_status_index on procurements (branch_id, status);

-- Gapless id counters, shared table; this service owns the 'procurements' counter
create table if not exists id_sequences (
  name varchar(40) primary key,
  value bigint not null
);
insert into id_sequences (name, value) values ('procurements', 0) on conflict (name) do nothing;
