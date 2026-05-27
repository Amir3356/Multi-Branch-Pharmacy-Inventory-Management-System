import { iso8601 } from '../utils/index.js'

// A procurement category: a name the Purchase Officer manages and picks in Create Procurement
export const TABLE = 'procurement_categories'
// The unique index on lower(name): one category per name, ignoring case
export const NAME_UNIQUE_INDEX = 'procurement_categories_name_unique'

/** CategoryResource: what the React app reads */
export const toResource = (c) => ({
  id: Number(c.id),
  name: c.name,
  createdAt: iso8601(c.created_at),
})
