-- Idempotent Record purchase: the Purchase Officer's screen sends one Idempotency-Key per order and the same key on
-- every retry (a lost response, a double tap), so an order is recorded once. Older orders have no key (null), which the
-- unique constraint allows any number of times.

alter table procurements add column if not exists idempotency_key uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'procurements_created_by_idempotency_key_unique') then
    alter table procurements
      add constraint procurements_created_by_idempotency_key_unique unique (created_by, idempotency_key);
  end if;
end $$;
