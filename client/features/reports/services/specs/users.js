import { unusedAccounts, usersByRole, usersByStatus } from '../../../accounts/services/accessReviewCharts'
import { count, date, dateTime } from './common'

// "about 4 months" for long gaps, "20 days" for short ones
const howLong = (days) => (days >= 60 ? `about ${Math.round(days / 30)} months` : `${days} days`)
const lastSignIn = (r) => (r.lastLoginAt ? dateTime(r.lastLoginAt) : r.lastLoginKnown === false ? 'No record' : 'Never')

/** User Report: every account as it stood at the end of the period, with dormant accounts flagged */
export function usersSpec(d) {
  const t = d.totals
  const rows = d.rows
  const months = Math.round(d.dormantDays / 30)
  // Dormant: active accounts nobody has used for the limit (invited people who never joined count under invitations)
  const { notUsed } = unusedAccounts(rows, d.dormantDays)
  const dormant = notUsed.map((r) => ({ name: r.fullName, row: r, why: r.lastLoginAt ? `Not used for ${howLong(r.daysSinceLogin)} · last signed in ${date(r.lastLoginAt)}` : 'Has never signed in' }))

  return {
    note: `Accounts as of ${dateTime(d.asOf)}`,
    cards: [
      { title: 'Users', icon: 'users', tone: 'cyan', value: count(t.users), chip: `${count(t.active)} active · ${count(t.pending)} pending · ${count(t.inactive)} inactive` },
      { title: 'Dormant Accounts', icon: 'dormant', tone: dormant.length ? 'danger' : 'teal', value: count(dormant.length), chip: `No sign-in for ${months}+ months`, chipTone: dormant.length ? 'negative' : 'positive' },
      { title: 'Invitation Links Expired', icon: 'invites', tone: 'warning', value: count(t.invitationExpired), chip: t.invitationExpired ? 'Resend or delete on Account Provision' : 'None waiting', chipTone: t.invitationExpired ? 'negative' : 'positive' }
    ],
    charts: [
      { kind: 'pie', title: 'Users by role', subtitle: `${count(rows.length)} ${rows.length === 1 ? 'user' : 'users'}`, items: usersByRole(rows), empty: 'No accounts in this period.' },
      { kind: 'donut', title: 'Account status', subtitle: 'At the end of the period', unit: 'users', items: usersByStatus(rows), empty: 'No accounts in this period.' },
      {
        kind: 'headline',
        title: 'Dormant Accounts',
        subtitle: `No sign-in for ${months}+ months`,
        count: dormant.length,
        label: dormant.length === 1 ? 'dormant account' : 'dormant accounts',
        advice: 'Check these people still work here. If not, deactivate or delete them on Account Provision.',
        list: dormant.map(({ name, why }) => ({ name, why }))
      }
    ],
    tables: [
      {
        title: 'Dormant accounts',
        columns: [{ label: 'Staff member' }, { label: 'Role' }, { label: 'Branch' }, { label: 'Status' }, { label: 'Last sign-in' }, { label: 'Why' }],
        rows: dormant.map(({ row, why }) => [row.fullName, row.roleLabel, row.branchName || '—', row.status, lastSignIn(row), why]),
        empty: 'Nobody is dormant.'
      },
      {
        title: 'Every user',
        columns: [{ label: 'Staff member' }, { label: 'Email' }, { label: 'Role' }, { label: 'Branch' }, { label: 'Status' }, { label: 'Created' }, { label: 'Last sign-in' }],
        rows: rows.map((r) => [r.fullName, r.email, r.roleLabel, r.branchName || '—', r.status, date(r.createdAt), lastSignIn(r)]),
        empty: 'No accounts in this period.'
      }
    ]
  }
}
