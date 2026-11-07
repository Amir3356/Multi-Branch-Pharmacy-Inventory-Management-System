import { useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, CheckCircle2, Package, Plus } from 'lucide-react'
import { Notice, PageHeader, StatCard } from '../components'
import { useBranchScope } from '../hooks'
import { selectTransfers } from '../features/transfers/store/transfersSlice'
import { selectInventory } from '../features/inventory/store/selectors'
import { selectProducts } from '../features/inventory/store/productsSlice'
import { selectSettings } from '../features/policy/store/settingsSlice'
import { selectCurrentUser } from '../features/auth/store/authSlice'
import { sendTransfer } from '../features/transfers/store/transfersThunks'
import NewTransferModal from '../features/transfers/components/NewTransferModal'
import TransfersTable from '../features/transfers/components/TransfersTable'
import './StockTransfersPage.css'

export default function StockTransfersPage() {
  const dispatch = useDispatch()
  const { branches, branchById, scopeLabel, inScope, selectedBranch } = useBranchScope()
  const allTransfers = useSelector(selectTransfers)
  const transfers = allTransfers.filter((t) => inScope(t.from) || inScope(t.to))
  const inventory = useSelector(selectInventory)
  const products = useSelector(selectProducts)
  const { maxTransferQty } = useSelector(selectSettings)
  const user = useSelector(selectCurrentUser)
  // Staff send from their own branch; the Owner (branch "all") picks any
  const assignedBranchId = user?.branchId && user.branchId !== 'all' ? user.branchId : null
  const [showNewTransfer, setShowNewTransfer] = useState(false)
  const [notice, setNotice] = useState(null)

  // One branch in view (its own staff, or a branch picked): split into what it sent and what it received
  const branchInView = selectedBranch !== 'all' ? selectedBranch : null
  const outgoing = useMemo(() => (branchInView ? allTransfers.filter((t) => t.from === branchInView) : []), [allTransfers, branchInView])
  const incoming = useMemo(() => (branchInView ? allTransfers.filter((t) => t.to === branchInView) : []), [allTransfers, branchInView])
  const sum = (list) => list.reduce((total, t) => total + t.qty, 0)

  // While this page is open, tell the sending branch when the other branch adds one of its transfers (pushed live)
  const seenStatus = useRef(null)
  useEffect(() => {
    const before = seenStatus.current
    seenStatus.current = Object.fromEntries(outgoing.map((t) => [t.id, t.status]))
    if (!before) return
    const added = outgoing.find((t) => t.status === 'Received' && before[t.id] === 'Pending')
    if (added) {
      setNotice({ type: 'success', text: `${branchById(added.to)?.name || 'The receiving branch'} added ${added.qty} × ${added.product} (${added.id}) to their stock${added.receivedBy ? ` — ${added.receivedBy}` : ''}.` })
    }
  }, [outgoing, branchById])

  // Saved on the server; the form shows any error
  const handleTransfer = async (data) => {
    setNotice({ type: 'success', text: await dispatch(sendTransfer(data)) })
    setShowNewTransfer(false)
  }

  return (
    <div className="content-section-card">
      <PageHeader centered title={`Stock Transfers · ${scopeLabel}`} description="Move stock between branches. It leaves the sending branch at once and reaches the receiving branch's Inventory when their Inventory Officer adds it (Receive Stock).">
        <button className="primary-action-btn" onClick={() => setShowNewTransfer(true)}>
          <Plus size={16} /> New Transfer
        </button>
      </PageHeader>

      <Notice notice={notice} onDismiss={() => setNotice(null)} />

      {branchInView ? (
        <>
          <div className="stats-grid" style={{ margin: '1.5rem 0' }}>
            <StatCard title="Sent" icon={ArrowUpRight} tone="warning" value={sum(outgoing).toLocaleString()} chip={`${outgoing.length} ${outgoing.length === 1 ? 'transfer' : 'transfers'} to other branches`} />
            <StatCard title="Received" icon={ArrowDownLeft} tone="teal" value={sum(incoming).toLocaleString()} chipTone="positive" chip={`${incoming.length} ${incoming.length === 1 ? 'transfer' : 'transfers'} from other branches`} />
          </div>

          <TransfersTable transfers={outgoing} products={products} branchById={branchById} show="to" emptyText="Nothing sent to other branches yet." />
        </>
      ) : (
        <>
          <div className="stats-grid" style={{ margin: '1.5rem 0' }}>
            <StatCard title="Total Transfers" icon={ArrowLeftRight} tone="cyan" value={transfers.length} chipTone="positive" chip={<><CheckCircle2 size={12} /> {transfers.filter((t) => t.status === 'Pending').length} pending</>} />
            <StatCard title="Quantity Transferred" icon={Package} tone="teal" value={sum(transfers).toLocaleString()} chip="Moved between branches" />
          </div>
          <TransfersTable transfers={transfers} products={products} branchById={branchById} emptyText="No stock transfers recorded." />
        </>
      )}

      {showNewTransfer && (
        <NewTransferModal branches={branches} assignedBranchId={assignedBranchId} inventory={inventory} maxQty={maxTransferQty} onClose={() => setShowNewTransfer(false)} onSave={handleTransfer} />
      )}
    </div>
  )
}
