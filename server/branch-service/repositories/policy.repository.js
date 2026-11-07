import { one } from '../utils/index.js'

// Every database read and write for the store's single policy row (Laravel's PolicyRepository)

const WITH_EDITOR = `select p.id, p.default_min_stock, p.expiry_warning_days, p.updated_by, p.updated_at, u.full_name as editor_name
  from policy_settings p left join users u on u.id = p.updated_by`

/** The policy (created with the defaults if the row is missing) */
export async function current() {
  const policy = await one(`${WITH_EDITOR} order by p.id limit 1`)
  if (policy) return policy
  await one('insert into policy_settings (default_min_stock, expiry_warning_days, created_at, updated_at) values (20, 60, now(), now()) returning id')
  return one(`${WITH_EDITOR} order by p.id limit 1`)
}

/** Saves the policy as changed by `userId`; nothing (not even updated_at) changes when every value is the same */
export async function update({ defaultMinStock, expiryWarningDays }, userId) {
  const policy = await current()
  await one(
    `update policy_settings set default_min_stock = $2, expiry_warning_days = $3, updated_by = $4, updated_at = now()
     where id = $1 and (default_min_stock <> $2 or expiry_warning_days <> $3 or updated_by is distinct from $4)`,
    [policy.id, defaultMinStock, expiryWarningDays, userId],
  )
  return one(`${WITH_EDITOR} where p.id = $1`, [policy.id])
}
