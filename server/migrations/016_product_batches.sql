-- A catalog product can have several Batch IDs. The Purchase Officer gets a new one each time they save a product on
-- the Category & Product page (Add Category & Product); the same product and category can then be bought under
-- different batches. A procurement names the batch it buys, and the Inventory Officer receives its stock under that
-- same Batch ID, so both officers see the same batch. Numbers come from the shared 'batches' counter (BT-00001, …).
-- products.batch stays as the product's newest batch.

create table if not exists product_batches (
  batch varchar(50) primary key,
  product_id varchar(20) not null references products (id) on delete cascade,
  created_by bigint,
  created_at timestamp(0)
);
create index if not exists product_batches_product_id_index on product_batches (product_id);

-- Products that already have a Batch ID keep it as their first batch
insert into product_batches (batch, product_id, created_at)
select batch, id, coalesce(created_at, now()) from products where batch is not null
on conflict (batch) do nothing;
