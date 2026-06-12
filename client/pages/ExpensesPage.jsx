import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Plus, Trash2 } from 'lucide-react'
import { EmptyRow, Notice, PageHeader } from '../components'
import { useBranchScope, useFormatMoney, useMoneyColumns } from '../hooks'
import { realtime } from '../api/realtime'
import { selectCurrentUser } from '../features/auth/store/authSlice'
import { selectExpenses } from '../features/expenses/store/expensesSlice'
import { deleteExpense, loadExpenses, recordExpense } from '../features/expenses/store/expensesThunks'
import ExpenseModal from '../features/expenses/components/ExpenseModal'

// The Inventory Officer's branch expenses: rent, transportation, utilities and other running costs
export default function ExpensesPage() {
  const dispatch = useDispatch()
  const formatMoney = useFormatMoney()
  const { moneyHeader, formatAmount } = useMoneyColumns()
  const { branchById, inScope, scopeLabel } = useBranchScope()
  const user = useSelector(selectCurrentUser)
  const expenses = useSelector(selectExpenses).filter((e) => inScope(e.branchId))
  const canRecord = user?.role === 'inventory_officer'
  const [showModal, setShowModal] = useState(false)
  const [notice, setNotice] = useState(null)

  // Loaded when the page opens, and again whenever this branch's expenses change on another screen
  const branchId = user?.branchId
  useEffect(() => {
    dispatch(loadExpenses()).catch(() => {})
    const echo = realtime()
    if (!echo || !branchId || branchId === 'all') return undefined
    const channel = `branch.${branchId}.expenses`
    echo.private(channel).listen('.expenses.changed', () => dispatch(loadExpenses()).catch(() => {}))
    return () => echo.leave(channel)
  }, [branchId, dispatch])

  const handleSave = async (form) => {
    setNotice({ type: 'success', text: await dispatch(recordExpense(form)) })
    setShowModal(false)
  }

  const handleDelete = async (expense) => {
    if (!window.confirm(`Delete the ${expense.category} expense of ${formatMoney(expense.amount)} on ${expense.date}?`)) return
    try {
      setNotice({ type: 'success', text: await dispatch(deleteExpense(expense)) })
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    }
  }

  return (
    <div className="content-section-card">
      <PageHeader centered title={`Expenses · ${scopeLabel}`} description="The branch's running costs: rent, transportation, utilities, salaries and more.">
        {canRecord && (
          <button className="primary-action-btn" onClick={() => setShowModal(true)}>
            <Plus size={16} /> Add Expense
          </button>
        )}
      </PageHeader>

      <Notice notice={notice} onDismiss={() => setNotice(null)} />

      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              {scopeLabel === 'All Branches' && <th>Branch</th>}
              <th>Category</th>
              <th>Description</th>
              <th>{moneyHeader('Amount')}</th>
              <th>Recorded By</th>
              {canRecord && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id}>
                <td className="nowrap">{e.date}</td>
                {scopeLabel === 'All Branches' && <td>{branchById(e.branchId)?.name || e.branchId}</td>}
                <td className="fw-600">{e.category}</td>
                <td>{e.description || '—'}</td>
                <td className="fw-600 negative-text">{formatAmount(e.amount)}</td>
                <td>{e.recordedBy || '—'}</td>
                {canRecord && (
                  <td>
                    <div className="row-actions" style={{ justifyContent: 'flex-start' }}>
                      <button type="button" className="icon-danger-btn" onClick={() => handleDelete(e)} aria-label={`Delete the ${e.category} expense`} title="Delete">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {expenses.length === 0 && <EmptyRow colSpan={5 + (scopeLabel === 'All Branches' ? 1 : 0) + (canRecord ? 1 : 0)}>No expenses recorded yet.</EmptyRow>}
          </tbody>
        </table>
      </div>

      {showModal && <ExpenseModal branchName={branchById(branchId)?.name || 'your branch'} onClose={() => setShowModal(false)} onSave={handleSave} />}
    </div>
  )
}
