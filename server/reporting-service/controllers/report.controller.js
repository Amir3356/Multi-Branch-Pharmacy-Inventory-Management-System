import * as reportService from '../services/report.service.js'

/* GET /reports/*: the validated period (req.validatedQuery) for the signed-in user, as { data } */

export async function financial(req, res) {
  res.json({ data: await reportService.financialReport(req.validatedQuery, req.user) })
}

export async function users(req, res) {
  res.json({ data: await reportService.userReport(req.validatedQuery, req.user) })
}

export async function procurement(req, res) {
  res.json({ data: await reportService.procurementReport(req.validatedQuery, req.user) })
}

export async function inventory(req, res) {
  res.json({ data: await reportService.inventoryReport(req.validatedQuery, req.user) })
}

export async function sales(req, res) {
  res.json({ data: await reportService.salesReport(req.validatedQuery, req.user) })
}
