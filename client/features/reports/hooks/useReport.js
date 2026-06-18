import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { realtime, watchConnection } from '../../../api/realtime'
import { useBranchScope } from '../../../hooks'
import { selectCurrentUser } from '../../auth/store/authSlice'
import { usePeriod } from '../../dashboard/hooks/usePeriod'
import { fetchReport } from '../../../api/reportsApi'

// Without a live connection the report reloads this often
const FALLBACK_REFRESH_MS = 60000
// Several actions in a burst (a sale writes its record and stock at once) cause one reload
const LIVE_DEBOUNCE_MS = 1500
// What reloads a report for staff who can't hear the audit log: each branch's channels and events behind its figures
const LIVE_CHANNELS = {
  procurement: [['procurements', '.procurement.changed']],
  sales: [['sales', '.sale.recorded']],
  inventory: [['stock', '.stock.changed'], ['transfers', '.transfer.changed'], ['damaged', '.damage.recorded'], ['sales', '.sale.recorded']]
}

/**
 * A report's period, branch and figures. Loads again whenever the period or branch changes, and updates by itself:
 * every action recorded anywhere (each is audit-logged, pushed live to the Owner) reloads the figures in place, and
 * without the live connection they reload every minute. Other staff can't hear the audit log, so their report reloads on
 * its branches' own events instead (procurements for the Purchase Officer; stock, transfers, damage and sales for the
 * Inventory Officer's Inventory Report; sales for the Cashier's Sales Report). Staff who work at one branch (Inventory Officer, Cashier) only see theirs.
 */
export function useReport(kind) {
  const period = usePeriod()
  const [pickedBranchId, setBranchId] = useState('all')
  // The figures, which request they answer and when; anything else selected means they're still loading
  const [result, setResult] = useState({ key: null, data: null, error: null, updatedAt: null })
  // Bumped to reload the same period and branch in the background
  const [version, setVersion] = useState(0)
  const [isLive, setIsLive] = useState(false)
  const user = useSelector(selectCurrentUser)
  const isOwner = user?.role === 'owner'
  // Those who cover every branch have 'all', and pick one
  const ownBranchId = user?.branchId && user.branchId !== 'all' ? user.branchId : null
  const branchId = ownBranchId || pickedBranchId
  const { branches } = useBranchScope()
  const liveBranchIds = isOwner ? '' : branches.map((b) => b.id).join(' ')
  const [from, to] = period.range
  const key = `${kind}|${from}|${to}|${branchId}`

  useEffect(() => {
    if (period.invalid) return undefined
    let cancelled = false
    fetchReport(kind, { from, to, branchId })
      .then(({ data }) => !cancelled && setResult({ key, data, error: null, updatedAt: new Date() }))
      // A failed background reload keeps the figures already shown
      .catch((e) => !cancelled && setResult((prev) => ({ key, data: prev.key === key ? prev.data : null, error: e.message, updatedAt: prev.updatedAt })))
    return () => {
      cancelled = true
    }
  }, [key, kind, from, to, branchId, period.invalid, version])

  // Live: reload shortly after anything is recorded; reconnecting catches up; no connection means once a minute
  useEffect(() => {
    let timer = null
    const reload = () => {
      clearTimeout(timer)
      timer = setTimeout(() => setVersion((v) => v + 1), LIVE_DEBOUNCE_MS)
    }
    const echo = realtime()
    // The branch channels are shared with the layout's own listeners, so only this listener is removed afterwards
    const branchChannels = liveBranchIds
      ? liveBranchIds.split(' ').flatMap((id) => (LIVE_CHANNELS[kind] || []).map(([channel, event]) => [`branch.${id}.${channel}`, event]))
      : []
    if (isOwner) echo?.private('audit-logs').listen('.audit-log.recorded', reload)
    branchChannels.forEach(([name, event]) => echo?.private(name).listen(event, reload))
    let wasConnected = null
    const stopWatching = watchConnection((connected) => {
      setIsLive(connected)
      if (connected && wasConnected === false) reload()
      wasConnected = connected
    })
    const fallback = setInterval(() => {
      if (!echo?.connector.pusher.connection || echo.connector.pusher.connection.state !== 'connected') setVersion((v) => v + 1)
    }, FALLBACK_REFRESH_MS)
    return () => {
      clearTimeout(timer)
      clearInterval(fallback)
      if (isOwner) echo?.leave('audit-logs')
      branchChannels.forEach(([name, event]) => echo?.private(name).stopListening(event, reload))
      stopWatching()
    }
  }, [isOwner, liveBranchIds, kind])

  const loading = !period.invalid && result.key !== key
  return { period, branchId, setBranchId, canPickBranch: !ownBranchId, data: result.data, error: loading ? null : result.error, loading, isLive, updatedAt: result.updatedAt }
}
