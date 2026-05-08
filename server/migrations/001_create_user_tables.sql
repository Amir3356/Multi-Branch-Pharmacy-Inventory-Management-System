-- user-service owns staff accounts and their history. IF NOT EXISTS everywhere: safe on the Laravel-built database.
-- auth-service writes only users.password and users.last_login_at.

create table if not exists users (
  id bigserial primary key,
  full_name varchar(255) not null,
  email varchar(255) not null constraint users_email_unique unique,
  password varchar(255), -- null until the invited person sets it from the invitation link
  role varchar(30) not null,
  branch_id varchar(20), -- branches.id (branch-service); null for those who cover every branch
  status varchar(20) not null default 'invited',
  email_verified_at timestamp(0),
  last_login_at timestamp(0),
  remember_token varchar(100),
  created_at timestamp(0),
  updated_at timestamp(0)
);

create table if not exists account_invitations (
  id bigserial primary key,
  user_id bigint not null constraint account_invitations_user_id_foreign references users (id) on delete cascade,
  invited_by bigint constraint account_invitations_invited_by_foreign references users (id) on delete set null,
  token_hash varchar(64) not null constraint account_invitations_token_hash_unique unique, -- SHA-256 of the emailed token
  expires_at timestamp(0) not null,
  created_at timestamp(0),
  updated_at timestamp(0)
);

-- Every role change, so access reviews can spot privilege creep
create table if not exists account_role_changes (
  id bigserial primary key,
  user_id bigint not null constraint account_role_changes_user_id_foreign references users (id) on delete cascade,
  from_role varchar(30) not null,
  to_role varchar(30) not null,
  changed_by bigint constraint account_role_changes_changed_by_foreign references users (id) on delete set null,
  changed_at timestamp(0) not null
);
create index if not exists account_role_changes_changed_at_index on account_role_changes (changed_at);

-- Status and branch changes, so a past period's report shows each account as it was then
create table if not exists account_changes (
  id bigserial primary key,
  user_id bigint not null constraint account_changes_user_id_foreign references users (id) on delete cascade,
  field varchar(20) not null, -- status | branch
  from_value varchar(30),
  to_value varchar(30),
  changed_by bigint constraint account_changes_changed_by_foreign references users (id) on delete set null,
  changed_at timestamp(0) not null
);
create index if not exists account_changes_changed_at_index on account_changes (changed_at);
create index if not exists account_changes_user_id_field_index on account_changes (user_id, field);

-- User (access review) reports: a snapshot of every account for a period
create table if not exists access_reviews (
  id bigserial primary key,
  period_start date not null,
  period_end date not null,
  period_type varchar(20) not null default 'quarterly', -- daily | weekly | monthly | quarterly | yearly | custom
  scheduled boolean not null default false,
  generated_by bigint constraint access_reviews_generated_by_foreign references users (id) on delete set null,
  summary json not null,
  rows json not null,
  reviewed_at timestamp(0),
  reviewed_by bigint constraint access_reviews_reviewed_by_foreign references users (id) on delete set null,
  review_note text,
  created_at timestamp(0),
  updated_at timestamp(0)
);
create index if not exists access_reviews_period_start_period_end_index on access_reviews (period_start, period_end);
