import { broadcast, logger } from '../utils/index.js'
import { toResource } from '../models/procurement.model.js'
import * as procurements from '../repositories/procurement.repository.js'

/**
 * Sends the change to the receiving branch's screens once the database change is committed (call it after the
 * transaction), re-reading the row first like the old fresh(). Never throws: screens catch up when they reconnect.
 */
export function procurementChanged(procurement) {
  procurements
    .find(procurement.id)
    .then((fresh) => {
      const row = fresh ?? procurement
      broadcast(`branch.${row.branch_id}.procurements`, 'procurement.changed', { procurement: toResource(row) })
    })
    .catch((error) => logger.warn('Live procurement update not sent', { procurement: procurement.id, error: error.message }))
}
