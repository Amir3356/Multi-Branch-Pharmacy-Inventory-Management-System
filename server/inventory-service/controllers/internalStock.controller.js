import { receiveStock, releaseStock, takeStock } from '../services/stockMovement.service.js'

// req.body is the parsed value from the internalStock validator

/** POST /internal/stock/take → { batches } */
export async function take(req, res) {
  res.json(await takeStock(req.body))
}

/** POST /internal/stock/release → { released } */
export async function release(req, res) {
  res.json(await releaseStock(req.body))
}

/** POST /internal/stock/receive → { batch, product }. req.user is the forwarded signed-in user (the Inventory Officer
 * receiving the order): recorded as price_set_by */
export async function receive(req, res) {
  res.json(await receiveStock(req.body, req.user))
}
