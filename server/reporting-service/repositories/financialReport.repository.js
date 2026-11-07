import { query } from '../utils/index.js'

/* The Financial Report's queries; each takes a { sql, values } condition from ReportPeriod.dates() */

export const expensesByCategory = (expenses) =>
  query(`select category, sum(amount) as amount, count(*) as entries from expenses where ${expenses.sql} group by category order by "amount" desc`, expenses.values)

export const damageByReason = (damaged) =>
  query(`select reason, sum(loss_value) as loss, sum(qty) as units from damaged_items where ${damaged.sql} group by reason order by "loss" desc`, damaged.values)

export const expenseRows = (listed) =>
  query(
    `select expenses.id, expenses.expense_date, branches.name as branch, expenses.category, expenses.description, expenses.amount, users.full_name as recorded_by
       from expenses left join branches on branches.id = expenses.branch_id left join users on users.id = expenses.recorded_by
       where ${listed.sql} order by "expense_date" desc, expenses.id desc limit 500`,
    listed.values,
  )
