import { iso8601 } from '../utils/index.js'

/** The store's single policy row (policy_settings) and its JSON shape (Laravel's PolicySetting and PolicyResource) */
export const MAX_EXPIRY_WARNING_DAYS = 730

/** PolicyResource */
export function presentPolicy(policy) {
  return {
    defaultMinStock: policy.default_min_stock,
    expiryWarningDays: policy.expiry_warning_days,
    updatedBy: policy.editor_name ?? null,
    updatedAt: iso8601(policy.updated_at),
  }
}
