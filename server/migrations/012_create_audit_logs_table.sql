-- reporting-service owns the audit log: who did what, where and when, never edited. Names are copied in, so the
-- history still reads correctly after an account or branch is renamed or deleted. IF NOT EXISTS: safe on the
-- Laravel-built database.

create table if not exists audit_logs (
  id bigserial primary key,
  occurred_at timestamp(0) not null,
  user_id bigint,
  user_name varchar(255), -- or the email typed in, for a failed sign-in
  user_role varchar(40),
  branch_id varchar(20),
  branch_name varchar(120),
  module varchar(40) not null,
  action varchar(80) not null,
  record_id varchar(60),
  description text not null,
  ip_address varchar(45),
  device varchar(120)
);
create index if not exists audit_logs_occurred_at_index on audit_logs (occurred_at);
create index if not exists audit_logs_branch_id_index on audit_logs (branch_id);
create index if not exists audit_logs_module_index on audit_logs (module);
