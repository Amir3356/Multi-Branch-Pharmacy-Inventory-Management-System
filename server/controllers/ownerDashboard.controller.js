import { summary } from '../services/ownerDashboard.service.js'

/** GET /dashboard/owner: sales, purchases, expenses and profit for a period, for every branch or one */
export async function show(req, res) {
  const data = req.validatedQuery
  res.json({ data: await summary(data.from, data.to, data.branchId ?? null) })
}
