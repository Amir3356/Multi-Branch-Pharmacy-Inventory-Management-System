import { useState } from 'react'
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Building2,
  X,
  Landmark,
  CheckCheck,
  Mail,
  MailOpen
} from 'lucide-react'
import { BranchTag } from '../../../components'

const NOTIFICATION_TYPES = {
  'low-stock': { label: 'Low Stock', icon: AlertTriangle, tone: 'warning' },
  expiring: { label: 'Expiring', icon: Clock, tone: 'danger' },
  tax: { label: 'Government Tax', icon: Landmark, tone: 'teal' }
}

export default function NotificationsPanel({ notifications, readIds, scopeLabel, onToggleRead, onMarkAllRead, onDismiss, onRestoreDismissed, dismissedCount, onOpen }) {
  const [filter, setFilter] = useState('all')
  const isRead = (n) => readIds.includes(n.id)
  const unreadCount = notifications.filter((n) => !isRead(n)).length

  const filters = [
    { key: 'all', label: 'All', count: notifications.length },
    { key: 'unread', label: 'Unread', count: unreadCount },
    ...Object.entries(NOTIFICATION_TYPES).map(([key, t]) => ({ key, label: t.label, count: notifications.filter((n) => n.type === key).length }))
  ]

  const visible = notifications.filter((n) => (filter === 'all' ? true : filter === 'unread' ? !isRead(n) : n.type === filter))

  return (
    <div className="content-section-card">
      <div className="section-header">
        <div>
          <h2 className="page-title">Notifications · {scopeLabel}</h2>
          <p className="page-desc">Stock alerts and government tax reminders that need your attention.</p>
        </div>
        <button type="button" className="secondary-action-btn" onClick={onMarkAllRead} disabled={unreadCount === 0}>
          <CheckCheck size={16} /> Mark all as read
        </button>
      </div>

      <div className="view-toggle notification-filters" role="tablist" aria-label="Filter notifications">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={filter === f.key}
            className={filter === f.key ? 'active' : ''}
            onClick={() => setFilter(f.key)}
          >
            {f.label} <span className="filter-count">{f.count}</span>
          </button>
        ))}
      </div>

      <ul className="notification-list">
        {visible.map((n) => {
          const type = NOTIFICATION_TYPES[n.type]
          const Icon = type.icon
          const read = isRead(n)
          return (
            <li key={n.id} className={`notification-item ${read ? 'read' : 'unread'}`}>
              <div className={`stat-icon-wrapper ${type.tone}`}>
                <Icon size={18} />
              </div>

              <div className="notification-body">
                <div className="notification-title-row">
                  {!read && <span className="unread-dot" aria-label="Unread" />}
                  <span className="notification-title">{n.title}</span>
                </div>
                <p className="notification-message">{n.message}</p>
                <div className="notification-meta">
                  {n.branch ? <BranchTag branch={n.branch} /> : <span className="branch-tag"><Building2 size={12} /> All Branches</span>}
                  <span>{n.meta}</span>
                </div>
              </div>

              <div className="notification-actions">
                <button type="button" className="link-btn" onClick={() => onOpen(n)}>
                  View <ArrowRight size={14} />
                </button>
                <button type="button" className="icon-btn" onClick={() => onToggleRead(n.id)} title={read ? 'Mark as unread' : 'Mark as read'} aria-label={read ? 'Mark as unread' : 'Mark as read'}>
                  {read ? <Mail size={15} /> : <MailOpen size={15} />}
                </button>
                <button type="button" className="icon-danger-btn" onClick={() => onDismiss(n.id)} title="Dismiss" aria-label="Dismiss">
                  <X size={15} />
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      {visible.length === 0 && (
        <div className="notification-empty">
          <CheckCircle2 size={28} />
          <span>{filter === 'unread' ? "You're all caught up." : 'No notifications here.'}</span>
        </div>
      )}

      {dismissedCount > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button type="button" className="link-btn" onClick={onRestoreDismissed}>
            Show {dismissedCount} dismissed {dismissedCount === 1 ? 'notification' : 'notifications'}
          </button>
        </div>
      )}
    </div>
  )
}
