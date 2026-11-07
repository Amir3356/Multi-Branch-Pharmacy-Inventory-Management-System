-- The Purchase Officer now adds products to the catalog (Products page): new ids are MED-00001, … from this counter,
-- started after the highest numbered MED- id already in the table so it never repeats one.
insert into id_sequences (name, value)
select 'products', coalesce(max(substring(id from '^MED-(\d+)$')::bigint), 0)
from products
on conflict (name) do nothing;
