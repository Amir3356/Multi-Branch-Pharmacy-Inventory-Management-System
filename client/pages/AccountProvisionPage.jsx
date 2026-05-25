import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Clock, Loader2, Pencil, Power, Send, Trash2, UserCog, UserPlus } from 'lucide-react'
import { BranchTag, EmptyRow, Notice, PageHeader, StatCard, StatusTag } from '../components'
import { useBranchScope, useNow } from '../hooks'
import { PATHS } from '../routes/paths'
import { formatDate, formatTime } from '../utils/dates'
import { selectCurrentUser } from '../features/auth/store/authSlice'
import { signOut as signOutThunk } from '../features/auth/store/authThunks'
import { selectAccounts } from '../features/accounts/store/accountsSlice'
import { selectIdleAfterMinutes, selectSessions, selectSignOutAfterMinutes } from '../features/accounts/store/sessionsSlice'
import { deleteAccount, loadAccounts, resendInvitation, saveAccount, toggleAccountStatus } from '../features/accounts/store/accountsThunks'
import { deleteSession, endSession, loadSessions } from '../features/accounts/store/sessionsThunks'
import { realtime, watchConnection } from '../api/realtime'
import AccountModal from '../features/accounts/components/AccountModal'
import SessionsPanel from '../features/accounts/components/SessionsPanel'
import './AccountProvisionPage.css'

const FALLBACK_REFRESH_MS = 60000

export default function AccountProvisionPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const now = useNow()
  const { branches, branchById } = useBranchScope()
  const currentUser = useSelector(selectCurrentUser)
  const accounts = useSelector(selectAccounts)
  const sessions = useSelector(selectSessions)
  const idleAfterMinutes = useSelector(selectIdleAfterMinutes)
  const signOutAfterMinutes = useSelector(selectSignOutAfterMinutes)
  const [editingAccount, setEditingAccount] = useState(null)
  const [notice, setNotice] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)

  useEffect(() => {
    dispatch(loadAccounts())
      .catch((error) => setNotice({ type: 'error', text: error.message }))
      .finally(() => setIsLoading(false))
  }, [dispatch])

  // Session Monitoring is live over the WebSocket: the server pushes a message the moment someone
  // signs in or out, and the list reloads. A slow check every minute covers a dropped connection.
  const [isLive, setIsLive] = useState(false)
  useEffect(() => {
    let inFlight = false
    let again = false
    const refresh = () => {
      if (document.visibilityState !== 'visible') return
      if (inFlight) {
        again = true
        return
      }
      inFlight = true
      dispatch(loadSessions())
        .catch(() => {})
        .finally(() => {
          inFlight = false
          if (again) {
            again = false
            refresh()
          }
        })
    }

    refresh()
    const echo = realtime()
    echo?.private('sessions').listen('.sessions.changed', refresh)
    const stopWatching = watchConnection((connected) => {
      setIsLive(connected)
      // Catch up on anything missed while disconnected
      if (connected) refresh()
    })
    const timer = setInterval(refresh, FALLBACK_REFRESH_MS)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      echo?.leave('sessions')
      stopWatching()
      clearInterval(timer)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [dispatch])

  // Runs one row action and shows its result; the row's buttons are disabled meanwhile
  const run = async (account, thunk) => {
    setBusyId(account.id)
    try {
      setNotice({ type: 'success', text: await dispatch(thunk) })
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    } finally {
      setBusyId(null)
    }
  }

  // Errors are thrown back to the modal so it can show them under the fields
  const handleSave = async (data) => {
    const message = await dispatch(saveAccount(editingAccount, data))
    setNotice({ type: 'success', text: message })
    setEditingAccount(null)
  }

  const handleDelete = (account) => {
    if (!window.confirm(`Delete the account for ${account.fullName}? They will no longer be able to sign in.`)) return
    run(account, deleteAccount(account))
  }

  const runSessionAction = async (thunk) => {
    try {
      setNotice({ type: 'success', text: await dispatch(thunk) })
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    }
  }

  const handleEndSession = (session) => {
    if (!window.confirm(`End ${session.email}'s session on ${session.device}? They will be signed out on that device.`)) return
    runSessionAction(endSession(session))
  }

  const handleDeleteSession = (session) => {
    const question = session.status === 'Ended'
      ? `Remove ${session.email}'s ended session on ${session.device} from the list?`
      : `Remove ${session.email}'s session on ${session.device}? They will be signed out on that device and it disappears from this list.`
    if (!window.confirm(question)) return
    runSessionAction(deleteSession(session))
  }

  const signOut = async () => {
    await dispatch(signOutThunk())
    navigate(PATHS.login, { replace: true })
  }

  const count = (status) => accounts.filter((a) => a.status === status).length

  return (
    <div className="content-section-card">
      <PageHeader centered title="Account Provision" description="Invite staff by email: Inventory Officer, Cashier, and Purchase Officer. They set their own password from the link.">
        <button className="primary-action-btn" onClick={() => setEditingAccount({})}>
          <UserPlus size={16} /> Create Account
        </button>
      </PageHeader>

      <Notice notice={notice} onDismiss={() => setNotice(null)} />

      <div className="stats-grid" style={{ margin: '1.5rem 0' }}>
        <StatCard title="Total Accounts" icon={UserCog} tone="cyan" value={accounts.length} chip="Staff logins" />
        <StatCard title="Active" icon={CheckCircle2} tone="teal" value={count('Active')} chip="Can sign in" chipTone="positive" />
        <StatCard title="Pending" icon={Clock} tone="warning" value={count('Pending')} chip="Invitation sent" />
      </div>

      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>No</th>
              <th>Full Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Branch</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a, index) => {
              const own = a.id === currentUser?.id
              const locked = own || a.role === 'owner'
              const lockReason = a.role === 'owner' ? 'The Owner account' : 'Your own account'
              const isActive = a.status === 'Active'
              const isPending = a.status === 'Pending'
              const busy = busyId === a.id
              return (
                <tr key={a.id}>
                  <td>{index + 1}</td>
                  <td className="fw-600 nowrap">
                    {a.fullName}
                    {own && <span className="current-chip">You</span>}
                  </td>
                  <td>{a.email}</td>
                  <td className="nowrap"><span className={`role-tag role-${a.role.replace('_', '-')}`}>{a.roleLabel}</span></td>
                  <td>{a.branchId === 'all' ? <BranchTag allBranches /> : <BranchTag branch={branchById(a.branchId)} />}</td>
                  <td className="nowrap">
                    <StatusTag status={a.status} />
                    {isPending && a.invitationExpired && <div className="field-hint">Invitation expired</div>}
                  </td>
                  <td className="nowrap">
                    {a.createdAt ? (
                      <>
                        {formatDate(new Date(a.createdAt))}
                        <div className="page-desc" style={{ margin: 0 }}>{formatTime(new Date(a.createdAt))}</div>
                      </>
                    ) : '—'}
                  </td>
                  <td>
                    <div className="row-actions" style={{ justifyContent: 'flex-start' }}>
                      <button type="button" className="icon-btn" onClick={() => setEditingAccount(a)} disabled={locked || busy} aria-label={`Edit ${a.fullName}`} title={locked ? `${lockReason} can't be edited here` : 'Edit'}>
                        <Pencil size={15} />
                      </button>
                      {isPending ? (
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => run(a, resendInvitation(a))}
                          disabled={busy}
                          aria-busy={busy}
                          aria-label={busy ? `Sending invitation to ${a.fullName}` : `Resend invitation to ${a.fullName}`}
                          title={busy ? 'Sending invitation…' : 'Resend invitation'}
                        >
                          {busy ? <Loader2 size={15} className="action-spin" /> : <Send size={15} />}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={`icon-btn ${isActive ? 'deactivate-btn' : 'activate-btn'}`}
                          onClick={() => run(a, toggleAccountStatus(a))}
                          disabled={locked || busy}
                          aria-label={`${isActive ? 'Deactivate' : 'Activate'} ${a.fullName}`}
                          title={locked ? `${lockReason} can't be deactivated` : isActive ? 'Deactivate' : 'Activate'}
                        >
                          <Power size={15} />
                        </button>
                      )}
                      <button
                        type="button"
                        className="icon-danger-btn"
                        onClick={() => handleDelete(a)}
                        disabled={locked || busy}
                        aria-label={`Delete ${a.fullName}`}
                        title={locked ? `${lockReason} can't be deleted` : 'Delete'}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {accounts.length === 0 && (
              <EmptyRow colSpan={8}>{isLoading ? 'Loading accounts…' : 'No accounts yet. Click Create Account to invite one.'}</EmptyRow>
            )}
          </tbody>
        </table>
      </div>

      <SessionsPanel sessions={sessions} idleAfterMinutes={idleAfterMinutes} signOutAfterMinutes={signOutAfterMinutes} isLive={isLive} branchById={branchById} now={now} onEnd={handleEndSession} onDelete={handleDeleteSession} onSignOut={signOut} />

      {editingAccount && <AccountModal account={editingAccount} branches={branches} onClose={() => setEditingAccount(null)} onSave={handleSave} />}
    </div>
  )
}
