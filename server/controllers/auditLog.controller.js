import { config } from '../utils/index.js'
import { paginate } from '../utils/paginator.js'
import { ACTION_TYPES, MODULES, PER_PAGE, toCountsResource, toResource } from '../models/auditLog.model.js'
import * as auditLogService from '../services/auditLog.service.js'

// The URL the browser called (through the gateway), which Laravel's paginator puts in its links
function publicPath(req) {
  const proto = req.get('x-forwarded-proto')?.split(',')[0].trim()
  const host = req.get('x-forwarded-host')?.split(',')[0].trim()
  const base = proto && host ? `${proto}://${host}` : config.appUrl
  return `${base}/api${req.path}`.replace(/\/$/, '')
}

/** GET /audit-logs: the Owner's Audit Logs page, filtered (req.validatedQuery) and paged */
export async function index(req, res) {
  const { rows, total, page, totals } = await auditLogService.list(req.validatedQuery, PER_PAGE)
  res.json({
    ...paginate({ items: rows.map(toResource), total, page, perPage: PER_PAGE, path: publicPath(req) }),
    modules: MODULES,
    actionTypes: ACTION_TYPES,
    counts: toCountsResource(totals),
  })
}

/** POST /audit-logs/views { section }: the signed-in user opened that page → { recorded } */
export async function view(req, res) {
  res.status(201).json({ recorded: await auditLogService.recordPageView(req, req.body.section) })
}

/**
 * Service-to-service: POST /internal/audit-logs (see ARCHITECTURE.md). Other services call it fire-and-forget through
 * their audit(), so a failure here never undoes their action.
 */
export async function store(req, res) {
  const id = await auditLogService.record(req.body)
  res.status(201).json({ id })
}
