import { STATUS_TONE } from '../utils'

// Coloured pill for a status label (In Stock, Paid, Active, …)
export default function StatusTag({ status }) {
  return <span className={`status-tag ${STATUS_TONE[status] || 'in-stock'}`}>{status}</span>
}
