-- The audit trail: every create, update, approve, reject, view and delete across the system, with the acting user, the
-- time, the module, and a before / after snapshot of the data that changed. Entries are permanent: the database itself
-- refuses to change or delete them, whoever asks (the Owner included), so the history can be trusted.

alter table audit_logs add column if not exists action_type varchar(20);
alter table audit_logs add column if not exists before_data jsonb;
alter table audit_logs add column if not exists after_data jsonb;

-- Entries recorded before this migration get their type from their action, the same rules the service uses
update audit_logs set action_type = case
  when action ilike '%failed sign-in%' or action ilike '%blocked sign-in%' or action ilike 'payment failed%' then 'reject'
  when action ilike 'signed in%' then 'login'
  when action ilike 'signed out%' then 'logout'
  when action ilike '%requested%' then 'other'
  when action ilike '%deleted%' or action ilike '%removed%' then 'delete'
  when action ilike '%confirmed%' or action ilike '%received%' or action ilike '%accepted%' or action ilike 'stock added%' then 'approve'
  when action ilike 'viewed%' then 'view'
  when action ilike '%updated%' or action ilike '%changed%' or action ilike '%corrected%' or action ilike '%regenerated%'
    or action ilike '%activated%' or action ilike '%ended%' or action ilike 'password reset' then 'update'
  when action ilike '%added%' or action ilike '%invited%' or action ilike '%recorded%' or action ilike '%created%'
    or action ilike '%generated%' or action ilike '%sent%' then 'create'
  else 'other'
end
where action_type is null;

alter table audit_logs alter column action_type set default 'other';
alter table audit_logs alter column action_type set not null;
create index if not exists audit_logs_action_type_index on audit_logs (action_type);
create index if not exists audit_logs_user_id_occurred_at_index on audit_logs (user_id, occurred_at);

-- Immutable: any UPDATE, DELETE or TRUNCATE of the audit log fails
create or replace function audit_logs_are_permanent() returns trigger language plpgsql as $$
begin
  raise exception 'Audit log entries are permanent: they cannot be changed or deleted.'
    using errcode = 'insufficient_privilege';
end
$$;

drop trigger if exists audit_logs_no_update_or_delete on audit_logs;
create trigger audit_logs_no_update_or_delete
  before update or delete on audit_logs
  for each row execute function audit_logs_are_permanent();

drop trigger if exists audit_logs_no_truncate on audit_logs;
create trigger audit_logs_no_truncate
  before truncate on audit_logs
  for each statement execute function audit_logs_are_permanent();
