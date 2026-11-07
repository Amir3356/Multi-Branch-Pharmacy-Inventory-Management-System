-- sales-service owns sales and branch expenses. IF NOT EXISTS everywhere: safe on the Laravel-built database.
-- branch ids (branch-service) and user ids (user-service) are referenced by id only.

create table if not exists sales (
  id varchar(20) primary key, -- "SL-00001"
  branch_id varchar(20) not null,
  customer varchar(255) not null default 'Walk-in Customer',
  category varchar(255) not null,
  product varchar(255) not null,
  med_id varchar(20),
  qty integer not null,
  batches json, -- [{"batch": "BT-00003", "qty": 5}, …]
  unit_price numeric(12, 2) not null,
  total numeric(12, 2) not null,
  status varchar(20) not null default 'paid',
  sold_by bigint,
  -- sent by the Cashier's screen: a retried sale finds this row instead of recording the sale twice
  idempotency_key uuid,
  created_at timestamp(0),
  updated_at timestamp(0),
  constraint sales_sold_by_idempotency_key_unique unique (sold_by, idempotency_key)
);
create index if not exists sales_branch_id_created_at_index on sales (branch_id, created_at);

create table if not exists expenses (
  id varchar(20) primary key, -- "EXP-00001"
  branch_id varchar(20) not null,
  category varchar(60) not null,
  description varchar(255),
  amount numeric(12, 2) not null,
  expense_date date not null,
  recorded_by bigint,
  created_at timestamp(0),
  updated_at timestamp(0)
);
create index if not exists expenses_branch_id_expense_date_index on expenses (branch_id, expense_date);

-- Gapless id counters, shared table; this service owns these counters
create table if not exists id_sequences (
  name varchar(40) primary key,
  value bigint not null
);
insert into id_sequences (name, value) values ('sales', 0), ('expenses', 0) on conflict (name) do nothing;
