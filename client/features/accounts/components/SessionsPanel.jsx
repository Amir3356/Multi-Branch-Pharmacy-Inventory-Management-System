import { sessionState } from '../store/sessionsSlice'
import {
  Clock,
  LogOut,
  Building2,
  UserCheck,
  MapPin,
  Monitor,
  Radio,
  Trash2,
  WifiOff
} from 'lucide-react'
import { toDateKey, timeAgo, formatSessionTime } from '../../../utils'
import { StatusTag, BranchTag } from '../../../components'

// Every sign-in from the last 7 days, from the server: open sessions first, then ended ones with the reason
export default function SessionsPanel({ sessions, idleAfterMinutes, signOutAfterMinutes, isLive, branchById, now, onEnd, onDelete, onSignOut }) {
  const withState = sessions.map((s) => ({ ...s, state: sessionState(s, now, idleAfterMinutes) }))
  const active = withState.filter((s) => s.state === 'Active').length
  const idle = withState.filter((s) => s.state === 'Idle')
  const signedInToday = withState.filter((s) => toDateKey(new Date(s.signedInAt)) === toDateKey(now)).length
  // This device first, then open sessions, then ended ones (last 7 days), each by latest activity
  const ended = (s) => (s.state === 'Ended' ? 1 : 0)
  const visible = [...withState].sort(
    (a, b) => (b.current ? 1 : 0) - (a.current ? 1 : 0) || ended(a) - ended(b) || (ended(a) ? b.endedAt - a.endedAt : b.lastActiveAt - a.lastActiveAt)
  )

  return (
    <div className="sessions-section">
      <div className="section-header" style={{ justifyContent: 'center', textAlign: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <Monitor size={18} /> Session Monitoring &amp; Management
          </h3>
          <p className="page-desc" style={{ textAlign: 'center' }}>
            See who is signed in, on which device, and end sessions when needed. Sessions go idle after {idleAfterMinutes} minutes without activity
            {signOutAfterMinutes ? ` and are signed out automatically after ${signOutAfterMinutes}.` : '.'}
          </p>
          <span
            className={`stat-chip ${isLive ? 'positive' : 'neutral'}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.5rem' }}
            title={isLive ? 'Changes appear the moment they happen' : 'Live connection unavailable; the list refreshes every minute'}
          >
            {isLive ? <Radio size={13} /> : <WifiOff size={13} />}
            {isLive ? 'Live' : 'Reconnecting… updating every minute'}
          </span>
        </div>
      </div>

      <div className="stats-grid" style={{ margin: '1.25rem 0' }}>
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-title">Active Sessions</span>
            <div className="stat-icon-wrapper teal">
              <Monitor size={20} />
            </div>
          </div>
          <div className="stat-value">{active}</div>
          <div className="stat-chip positive">Used in the last {idleAfterMinutes} min</div>
        </div>
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-title">Idle Sessions</span>
            <div className="stat-icon-wrapper warning">
              <Clock size={20} />
            </div>
          </div>
          <div className="stat-value">{idle.length}</div>
          <div className="stat-chip neutral">Inactive for {idleAfterMinutes}+ min</div>
        </div>
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-title">Signed In Today</span>
            <div className="stat-icon-wrapper cyan">
              <UserCheck size={20} />
            </div>
          </div>
          <div className="stat-value">{signedInToday}</div>
          <div className="stat-chip neutral">New sessions today</div>
        </div>
      </div>

      <div className="table-responsive" style={{ marginTop: '0.75rem' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>No</th>
              <th>Staff Member</th>
              <th>Branch</th>
              <th>Device</th>
              <th>IP Address</th>
              <th>Location</th>
              <th>Signed In</th>
              <th>Last Active</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((s, index) => {
              return (
                <tr key={s.id}>
                  <td>{index + 1}</td>
                  <td className="nowrap">
                    <span className="fw-600" title={s.email}>{s.fullName}</span>
                    {s.current && <span className="current-chip">This device</span>}
                    <span className={`role-tag role-${s.role.replace('_', '-')} session-role`}>{s.roleLabel}</span>
                  </td>
                  <td>
                    {s.branchId === 'all'
                      ? <span className="branch-tag"><Building2 size={12} /> All Branches</span>
                      : <BranchTag branch={branchById(s.branchId)} />}
                  </td>
                  <td className="nowrap">{s.device}</td>
                  <td className="font-mono">{s.ip || '—'}</td>
                  <td className="nowrap">
                    {s.location ? (
                      <span
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                        title={s.locationSource === 'device' ? "From the device's location" : 'Approximate, from the IP address'}
                      >
                        {s.locationSource === 'device' && <MapPin size={13} aria-hidden="true" />}
                        {s.location}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="nowrap">{formatSessionTime(new Date(s.signedInAt), now)}</td>
                  <td className="nowrap">
                    {s.state === 'Ended' ? `Ended ${timeAgo(s.endedAt, now)}` : timeAgo(s.lastActiveAt, now)}
                    {s.state === 'Ended' && s.endedReason && <div className="field-hint">{s.endedReason}</div>}
                  </td>
                  <td><StatusTag status={s.state} /></td>
                  <td>
                    <div className="row-actions" style={{ justifyContent: 'flex-start', gap: '0.5rem' }}>
                      {s.state === 'Ended' ? (
                        onDelete ? (
                          <button type="button" className="icon-danger-btn" onClick={() => onDelete(s)} title="Remove from list" aria-label={`Remove ${s.email}'s ended session`}>
                            <Trash2 size={14} />
                          </button>
                        ) : (
                          <span className="not-set">—</span>
                        )
                      ) : s.current ? (
                        <button type="button" className="link-btn" onClick={onSignOut}>
                          <LogOut size={14} /> End Session
                        </button>
                      ) : (
                        <>
                          <button type="button" className="link-btn danger-link" onClick={() => onEnd(s)}>
                            <LogOut size={14} /> End Session
                          </button>
                          {onDelete && (
                            <button
                              type="button"
                              className="icon-danger-btn"
                              onClick={() => onDelete(s)}
                              title="Delete Session"
                              aria-label={`Delete session for ${s.email}`}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan="10" style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '2rem' }}>
                  No sign-ins in the last 7 days.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
