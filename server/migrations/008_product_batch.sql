-- Each catalog product gets its Batch ID when the Purchase Officer saves it (Category & Product page). The same ID is
-- used when its stock is received, so the Inventory Officer sees the batch the Purchase Officer saw. Taken from the
-- shared 'batches' counter, so it can never clash with a batch number generated another way.
alter table products add column if not exists batch varchar(50);
create unique index if not exists products_batch_unique on products (batch);

-- Products that existed before this get theirs now, in id order
do $$
declare
  product record;
  next_value bigint;
begin
  insert into id_sequences (name, value) values ('batches', 0) on conflict (name) do nothing;
  for product in select id from products where batch is null order by id loop
    update id_sequences set value = value + 1 where name = 'batches' returning value into next_value;
    update products set batch = 'BT-' || lpad(next_value::text, 5, '0') where id = product.id;
  end loop;
end $$;
