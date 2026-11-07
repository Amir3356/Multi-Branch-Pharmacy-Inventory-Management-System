import { one } from '../utils/index.js'
import { DEFAULTS } from '../models/policy.model.js'

/** The store policy (minimum stock, expiry warning days), as PolicyRepository::current() returned it */
export async function currentPolicy() {
  const row = await one('select default_min_stock, expiry_warning_days from policy_settings limit 1')
  return {
    default_min_stock: Number(row?.default_min_stock ?? DEFAULTS.default_min_stock),
    expiry_warning_days: Number(row?.expiry_warning_days ?? DEFAULTS.expiry_warning_days),
  }
}
