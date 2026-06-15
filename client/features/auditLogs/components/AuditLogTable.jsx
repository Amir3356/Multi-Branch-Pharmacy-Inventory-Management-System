import { Fragment, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { EmptyRow } from '../../../components'
import { ACTION_TYPE_LABELS, actionTone, auditDate, auditTime, hasSnapshot, snapshotRows } from '../model/auditLog'

const COLUMNS = 8

// What the data looked like before and after the action: changed fields first and highlighted
function SnapshotDiff({ log }) {
  const rows = snapshotRows(log.before, log.after)
  const both = Boolean(log.before && log.after)
  const changedCount = rows.filter((r) => r.changed).length
  return (
    <div className="audit-diff">
      <p className="audit-diff-title">
        {both ? `${changedCount} ${changedCount === 1 ? 'field' : 'fields'} changed` : log.after ? 'Record as created' : 'Record as it was before'}
        {log.recordId && <span className="batch-badge audit-record">{log.recordId}</span>}
      </p>
      <div className="table-responsive">
        <table className="audit-diff-table">
          <thead>
            <tr>
              <th>Field</th>
              {log.before && <th>Before</th>}
              {log.after && <th>After</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className={r.changed ? 'changed' : undefined}>
                <th scope="row">{r.label}</th>
                {log.before && <td className={r.changed ? 'was' : undefined}>{r.was}</td>}
                {log.after && <td className={r.changed ? 'now' : undefined}>{r.now}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// The audit log as a table, newest first: one row per recorded action; rows with snapshots expand to show the change
export default function AuditLogTable({ logs, freshIds, isLoading }) {
  const [open, setOpen] = useState(() => new Set())
  const toggle = (id) => setOpen((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  return (
    <div className="table-responsive audit-table">
      <table className="data-table">
        <thead>
          <tr>
            <th aria-label="Changes" />
            <th>Date &amp; Time</th>
            <th>User &amp; Role</th>
            <th>Branch</th>
            <th>Module</th>
            <th>Action</th>
            <th>Description</th>
            <th>IP Address &amp; Device</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => {
            const expandable = hasSnapshot(log)
            const isOpen = open.has(log.id)
            return (
              <Fragment key={log.id}>
                <tr className={[isOpen && 'audit-row-open', freshIds?.has(log.id) && 'audit-row-new'].filter(Boolean).join(' ') || undefined}>
                  <td className="audit-toggle-cell">
                    {expandable && (
                      <button type="button" className="icon-btn" onClick={() => toggle(log.id)} aria-expanded={isOpen} aria-label={`${isOpen ? 'Hide' : 'Show'} before and after for ${log.action}`} title="Before / after">
                        {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                      </button>
                    )}
                  </td>
                  <td className="nowrap">
                    <div className="fw-600">{auditDate(log.occurredAt)}</div>
                    <div className="audit-sub">{auditTime(log.occurredAt)}</div>
                  </td>
                  <td>
                    <div className="fw-600">{log.userName || '—'}</div>
                    <div className="audit-sub">{log.userRole || '—'}</div>
                  </td>
                  <td>{log.branchName || 'All branches'}</td>
                  <td><span className="audit-module">{log.module}</span></td>
                  <td>
                    <span className={`audit-action ${actionTone(log.actionType)}`}>{ACTION_TYPE_LABELS[log.actionType] || log.actionType}</span>
                  </td>
                  {/* What the user did: the full action and its record, then the details */}
                  <td className="audit-details">
                    <div className="audit-what">
                      {log.action}
                      {log.recordId && <span className="batch-badge audit-record">{log.recordId}</span>}
                    </div>
                    {log.description}
                  </td>
                  <td className="nowrap">
                    <div>{log.ipAddress || '—'}</div>
                    {log.device && <div className="audit-sub">{log.device}</div>}
                  </td>
                </tr>
                {isOpen && (
                  <tr className="audit-diff-row">
                    <td colSpan={COLUMNS}>
                      <SnapshotDiff log={log} />
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
          {logs.length === 0 && <EmptyRow colSpan={COLUMNS}>{isLoading ? 'Loading audit logs…' : 'No actions match these filters.'}</EmptyRow>}
        </tbody>
      </table>
    </div>
  )
}
