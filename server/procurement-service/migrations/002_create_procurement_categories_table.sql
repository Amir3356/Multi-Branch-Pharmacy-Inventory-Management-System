-- Procurement categories: the list the Purchase Officer keeps on the Categories page and picks from in Create
-- Procurement. Orders store the category's name, so renaming or deleting one leaves past orders as they were.

create table if not exists procurement_categories (
  id bigserial primary key,
  name varchar(120) not null,
  created_by bigint,
  created_at timestamp(0),
  updated_at timestamp(0)
);
create unique index if not exists procurement_categories_name_unique on procurement_categories (lower(name));

-- Starting categories for a supermarket (the ones the app offered before this list existed)
insert into procurement_categories (name, created_at, updated_at)
select name, now(), now()
from (values
  ('Fruits & Vegetables'), ('Dairy & Eggs'), ('Meat & Fish'), ('Bakery'), ('Beverages'), ('Snacks & Sweets'),
  ('Grains, Rice & Pasta'), ('Cooking Oil & Spices'), ('Canned & Packaged Food'), ('Frozen Food'), ('Baby Products'),
  ('Personal Care'), ('Household & Cleaning'), ('Kitchenware'), ('Stationery'), ('Electronics & Batteries')
) as defaults (name)
on conflict do nothing;
