import { one } from '../utils/index.js'

// branches belong to branch-service; reading them is allowed

/** The branch when it exists and is active, otherwise null */
export const findActiveBranch = (id) => one("select 1 from branches where id = $1 and status = 'active'", [id])
