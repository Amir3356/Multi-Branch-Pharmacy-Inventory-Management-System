/** The store policy (policy_settings, owned by branch-service; read only here) */
export const TABLE = 'policy_settings'

// Laravel created the row with these values when it was missing; branch-service owns the table, so here they are only read
export const DEFAULTS = Object.freeze({ default_min_stock: 20, expiry_warning_days: 60 })
