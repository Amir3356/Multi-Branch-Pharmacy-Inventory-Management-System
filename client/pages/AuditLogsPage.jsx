import { useEffect, useRef, useState } from 'react'
import { Activity, CalendarClock, ChevronLeft, ChevronRight, Filter, Lock, Radio, Search } from 'lucide-react'
import { PageHeader, StatCard } from '../components'
import { useBranchScope } from '../hooks'
import { realtime, watchConnection } from '../api/realtime'
import { fetchAuditLogs } from '../api/auditLogsApi'
import AuditLogTable from '../features/auditLogs/components/AuditLogTable'
import { ACTION_TYPE_LABELS, AUDIT_ACTION_TYPES, AUDIT_MODULES } from '../features/auditLogs/model/auditLog'
import { usePeriod } from '../features/dashboard/hooks/usePeriod'
import { PeriodError, PeriodPicker } from '../features/dashboard/components/DashboardParts'

// Without a live connection the page checks for new entries this often
const FALLBACK_REFRESH_MS = 60000

// Owner: the audit trail. Every create, update, approve, reject, view and delete across the system, recorded on the
// server with who, when, which module and a before / after snapshot. Read only: entries can never be edited or deleted.
export default function AuditLogsPage() {
  const { branches } = useBranchScope()
  const period = usePeriod()
  const [module, setModule] = useState('all')
  const [type, setType] = useState('all')
  const [branchId, setBranchId] = useState('all')
  const [searchText, setSearchText] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState({
    data: [],
    meta: null,
    modules: AUDIT_MODULES,
    actionTypes: AUDIT_ACTION_TYPES,
    counts: null
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isLive, setIsLive] = useState(false)
  // Entries that arrived live since the last load: highlighted for a moment on page 1; on older pages, counted in a
  // "new activity" button instead of shifting the rows being read
  const newestSeen = useRef(null)
  // The whole log's size at the last load (it ignores filters), so a later load knows how many arrived
  const lastTotal = useRef(null)
  const [freshIds, setFreshIds] = useState(() => new Set())
  const [unseenCount, setUnseenCount] = useState(0)
  const [from, to] = period.range

  // Typing waits a moment before searching, so each letter doesn't send a request
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchText.trim()), 350)
    return () => clearTimeout(timer)
  }, [searchText])

  // Any filter change starts again from page 1
  const filtersKey = `${from}|${to}|${module}|${type}|${branchId}|${search}`
  const [shownFilters, setShownFilters] = useState(filtersKey)
  if (shownFilters !== filtersKey) {
    setShownFilters(filtersKey)
    setPage(1)
  }

  const load = useRef(() => {})
  useEffect(() => {
    if (period.invalid) return
    let cancelled = false
    load.current = () => {
      setIsLoading(true)
      fetchAuditLogs({ from, to, module, type, branchId, search, page })
        .then((data) => {
          if (cancelled) return
          const newest = data.data[0]?.id ?? null
          if (page === 1) {
            const previous = newestSeen.current
            setFreshIds(new Set(previous === null ? [] : data.data.filter((log) => log.id > previous).map((log) => log.id)))
            if (newest !== null) newestSeen.current = Math.max(newest, previous ?? 0)
            setUnseenCount(0)
          } else if (lastTotal.current !== null && data.counts) {
            setUnseenCount((n) => n + Math.max(0, data.counts.total - lastTotal.current))
          }
          if (data.counts) lastTotal.current = data.counts.total
          setResult(data)
          setError(null)
        })
        .catch((e) => !cancelled && setError(e.message))
        .finally(() => !cancelled && setIsLoading(false))
    }
    load.current()
    return () => {
      cancelled = true
    }
  }, [from, to, module, type, branchId, search, page, period.invalid])

  // New entries arrive live; without the connection, the list refreshes every minute
  useEffect(() => {
    const refresh = () => load.current()
    const echo = realtime()
    echo?.private('audit-logs').listen('.audit-log.recorded', refresh)
    const stopWatching = watchConnection((connected) => {
      setIsLive(connected)
      if (connected) refresh()
    })
    const timer = setInterval(refresh, FALLBACK_REFRESH_MS)
    return () => {
      echo?.leave('audit-logs')
      stopWatching()
      clearInterval(timer)
    }
  }, [])

  const { data: logs, meta, modules, actionTypes, counts } = result
  const availableModules = (modules && modules.length > 0) ? modules : AUDIT_MODULES
  const availableActionTypes = (actionTypes && actionTypes.length > 0) ? actionTypes : AUDIT_ACTION_TYPES
  const filtersActive = module !== 'all' || type !== 'all' || branchId !== 'all' || search !== ''
  const clearFilters = () => {
    setModule('all')
    setType('all')
    setBranchId('all')
    setSearchText('')
  }

  return (
    <div className="content-section-card">
      <PageHeader title="Audit Logs" description="Every create, update, approve, reject, view and delete across the system: who did it, when, in which module, and the data before and after. Open a row to see what changed.">
        <div className="audit-header-chips">
        <span className="stat-chip neutral" title="The database refuses any change or deletion of an entry, whoever asks, the Owner included">
          <Lock size={13} /> Permanent record
        </span>
        <span className={`stat-chip ${isLive ? 'positive' : 'neutral'}`} title={isLive ? 'New actions appear the moment they happen' : 'Live connection unavailable; the list refreshes every minute'}>
          <Radio size={13} /> {isLive ? 'Live' : 'Refreshes every minute'}
        </span>
        </div>
      </PageHeader>

      {/* Every branch and module, whatever the filters below: the whole log, and today's share of it */}
      <div className="stats-grid" style={{ margin: '1.5rem 0 0.5rem' }}>
        <StatCard
          title="Total Activities"
          icon={Activity}
          tone="cyan"
          value={counts ? counts.total.toLocaleString() : '—'}
          chip={counts?.since ? `Since ${new Date(counts.since).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : 'Nothing recorded yet'}
        />
        <StatCard
          title="Today's Activities"
          icon={CalendarClock}
          tone="teal"
          value={counts ? counts.today.toLocaleString() : '—'}
          chipTone={counts?.today ? 'positive' : 'neutral'}
          chip={counts ? `By ${counts.todayUsers} ${counts.todayUsers === 1 ? 'staff member' : 'staff members'}` : ' '}
        />
      </div>

      <div className="dashboard-toolbar">
        <PeriodPicker state={period} errorId="audit-range-error" />
        {!period.invalid && <p className="page-desc">{period.text}</p>}
      </div>

      <div className="filter-bar">
        <div className="filter-search">
          <Search size={16} className="filter-search-icon" />
          <input type="search" className="input-field" placeholder="Search by user, action, record or details…" aria-label="Search audit logs" value={searchText} onChange={(e) => setSearchText(e.target.value)} />
        </div>
        <select className="input-field filter-select" aria-label="Filter by module" value={module} onChange={(e) => setModule(e.target.value)}>
          <option value="all">All Modules</option>
          {availableModules.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <select className="input-field filter-select" aria-label="Filter by action type" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="all">All Actions</option>
          {availableActionTypes.map((t) => (
            <option key={t} value={t}>{ACTION_TYPE_LABELS[t] || t}</option>
          ))}
        </select>
        <select className="input-field filter-select" aria-label="Filter by branch" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
          <option value="all">All Branches</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>

      {period.invalid ? <PeriodError id="audit-range-error" /> : (
        <>
          <div className="filter-summary">
            <span>
              <Filter size={14} /> <strong>{meta?.total ?? 0}</strong> {meta?.total === 1 ? 'action' : 'actions'} recorded
            </span>
            {filtersActive && <button type="button" className="link-btn" onClick={clearFilters}>Clear filters</button>}
          </div>
          {error && <p className="error-msg" style={{ marginTop: '0.75rem' }}>{error}</p>}

          {unseenCount > 0 && (
            <button type="button" className="audit-new-activity" onClick={() => setPage(1)}>
              <Radio size={14} /> {unseenCount} new {unseenCount === 1 ? 'action' : 'actions'} since you opened this page. Show newest
            </button>
          )}

          <AuditLogTable logs={logs} freshIds={freshIds} isLoading={isLoading && !logs.length} />

          {meta && meta.last_page > 1 && (
            <div className="audit-pager">
              <span className="page-desc">Showing {meta.from}–{meta.to} of {meta.total}</span>
              <div className="audit-pager-buttons">
                <button type="button" className="secondary-action-btn" onClick={() => setPage((p) => p - 1)} disabled={page <= 1 || isLoading}>
                  <ChevronLeft size={16} /> Newer
                </button>
                <span className="page-desc">Page {meta.current_page} of {meta.last_page}</span>
                <button type="button" className="secondary-action-btn" onClick={() => setPage((p) => p + 1)} disabled={page >= meta.last_page || isLoading}>
                  Older <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
