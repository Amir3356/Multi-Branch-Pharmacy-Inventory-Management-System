-- A Batch ID is bought once: when an order under it is recorded (Paid), no other order can buy the same batch. The
-- Purchase Officer adds a new Batch ID on the Category & Product page to buy the product again. Orders without a
-- batch (null) are not limited.
create unique index if not exists procurements_batch_unique on procurements (batch) where batch is not null;
