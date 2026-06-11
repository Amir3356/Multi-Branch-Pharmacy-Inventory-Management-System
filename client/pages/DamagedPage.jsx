import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Plus } from 'lucide-react'
import { BranchTag, EmptyRow, Notice, PageHeader } from '../components'
import { useBranchScope, useFormatMoney, useMoneyColumns } from '../hooks'
import { selectDamaged } from '../features/damaged/store/damagedSlice'
import { selectInventory } from '../features/inventory/store/selectors'
import { recordDamage } from '../features/damaged/store/damagedThunks'
import RecordDamageModal from '../features/damaged/components/RecordDamageModal'
import './DamagedPage.css'

export default function DamagedPage() {
  const dispatch = useDispatch()
  const formatMoney = useFormatMoney()
  const { moneyHeader, formatAmount } = useMoneyColumns()
  const { branchById, isAllBranches, scopeLabel, inScope } = useBranchScope()
  const damaged = useSelector(selectDamaged).filter((d) => inScope(d.branchId))
  const inventory = useSelector(selectInventory)
  const [showRecordDamage, setShowRecordDamage] = useState(false)
  const [notice, setNotice] = useState(null)

  // Errors are shown in the form (it catches them)
  const handleRecordDamage = async (data) => {
    setNotice({ type: 'success', text: await dispatch(recordDamage(data)) })
    setShowRecordDamage(false)
  }

  return (
    <div className="content-section-card">
      <PageHeader centered title={`Damaged Items · ${scopeLabel}`} description="Products that were physically damaged and can no longer be sold or used.">
        <button className="primary-action-btn" onClick={() => setShowRecordDamage(true)}>
          <Plus size={16} /> Record Damaged Item
        </button>
      </PageHeader>

      <Notice notice={notice} onDismiss={() => setNotice(null)} />

      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>No</th>
              <th>Date</th>
              {isAllBranches && <th>Branch</th>}
              <th>Category</th>
              <th>Product Name</th>
              <th>Batch</th>
              <th>Quantity</th>
              <th>Reason</th>
              <th>{moneyHeader('Loss Value')}</th>
            </tr>
          </thead>
          <tbody>
            {damaged.map((d, index) => (
              <tr key={d.id}>
                <td>{index + 1}</td>
                <td className="nowrap">{d.date}</td>
                {isAllBranches && <td><BranchTag branch={branchById(d.branchId)} /></td>}
                <td>{d.category}</td>
                <td className="fw-600">{d.product}</td>
                <td><span className="batch-badge">{d.batch}</span></td>
                <td>{d.qty} {d.qty === 1 ? 'unit' : 'units'}</td>
                <td>{d.reason}</td>
                <td className="fw-600 negative-text">{formatAmount(d.lossValue)}</td>
              </tr>
            ))}
            {damaged.length === 0 && <EmptyRow colSpan={isAllBranches ? 9 : 8}>No damaged items recorded.</EmptyRow>}
          </tbody>
        </table>
      </div>

      {showRecordDamage && (
        <RecordDamageModal inventory={inventory.filter((i) => inScope(i.branchId))} formatMoney={formatMoney} onClose={() => setShowRecordDamage(false)} onSave={handleRecordDamage} />
      )}
    </div>
  )
}
