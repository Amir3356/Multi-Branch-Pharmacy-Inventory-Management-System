-- A ledger of stock moves requested by other services (sales, procurements), one row per reference such as
-- 'sale:12:7c1f…' or 'procurement:PO-00004'. The unique reference makes each move happen exactly once however often
-- it is retried, and lets the caller undo a move whose own save then failed (released_at).
create table if not exists stock_movements (
  id bigserial primary key,
  reference varchar(120) not null constraint stock_movements_reference_unique unique,
  kind varchar(10) not null, -- take | add
  branch_id varchar(20) not null,
  product varchar(255) not null,
  parts json not null, -- [{"batch": "BT-00003", "qty": 5}, …]
  result json, -- what the call returned, replayed on a retry
  released_at timestamp(0),
  created_at timestamp(0) not null
);
create index if not exists stock_movements_branch_id_created_at_index on stock_movements (branch_id, created_at);
