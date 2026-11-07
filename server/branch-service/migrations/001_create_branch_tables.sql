-- branch-service owns branches and the store policy. IF NOT EXISTS everywhere: safe on the Laravel-built database.
-- Other services refer to branches by id only (no cross-service foreign keys on a fresh install).

create table if not exists branches (
  id varchar(20) primary key, -- "BR-01"
  name varchar(255) not null constraint branches_name_unique unique,
  location varchar(255),
  status varchar(20) not null default 'active',
  created_at timestamp(0),
  updated_at timestamp(0)
);

-- One row: when stock counts as Low, and how close to expiry a batch counts as Expiring Soon
create table if not exists policy_settings (
  id bigserial primary key,
  default_min_stock integer not null,
  expiry_warning_days smallint not null,
  updated_by bigint, -- users.id (user-service)
  created_at timestamp(0),
  updated_at timestamp(0)
);
insert into policy_settings (default_min_stock, expiry_warning_days, created_at, updated_at)
select 20, 60, now(), now()
where not exists (select 1 from policy_settings);

-- Gapless id counters, shared table; this service owns the 'branches' counter
create table if not exists id_sequences (
  name varchar(40) primary key,
  value bigint not null
);
insert into id_sequences (name, value) values ('branches', 0) on conflict (name) do nothing;
