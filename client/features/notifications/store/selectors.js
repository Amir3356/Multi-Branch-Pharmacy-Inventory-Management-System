import { createSelector } from '@reduxjs/toolkit'
import { daysUntil, formatDate, startOfToday } from '../../../utils'
import { selectInventory } from '../../inventory/store/selectors'
import { selectBranches } from '../../branches/store/branchesSlice'
import { selectSettings } from '../../policy/store/settingsSlice'
import { selectBranchInView } from '../../auth/store/authSlice'
import { PATHS } from '../../../routes/paths'

const TAX_REMINDER_DAYS = 60

// Next yearly due date of a government tax on or after today
const nextTaxDueDate = (rate) => {
  const today = startOfToday()
  const thisYear = new Date(today.getFullYear(), rate.dueMonth - 1, rate.dueDay)
  return thisYear >= today ? thisYear : new Date(today.getFullYear() + 1, rate.dueMonth - 1, rate.dueDay)
}

// Notifications generated from current stock and the tax policy, for the selected branch scope
export const selectAllNotifications = createSelector(
  [selectInventory, selectBranches, selectSettings, selectBranchInView],
  (inventory, branches, settings, selectedBranch) => {
    const branchById = (id) => branches.find((b) => b.id === id)
    const scoped = inventory.filter((i) => selectedBranch === 'all' || i.branchId === selectedBranch)
    return [
      // One alert per product at a branch, however many batches it has (stock levels are per product)
      ...scoped
        .filter((i) => i.status !== 'In Stock')
        .filter((i, index, rows) => rows.findIndex((r) => r.medId === i.medId && r.branchId === i.branchId) === index)
        .map((i) => ({
          id: `low-${i.medId}-${i.branchId}-${i.productStock}`,
          type: 'low-stock',
          path: PATHS.inventory,
          branch: branchById(i.branchId),
          title: i.status === 'Out of Stock' ? `Out of stock: ${i.name}` : `Low stock: ${i.name}`,
          message: i.status === 'Out of Stock'
            ? 'No units left at this branch. Create a purchase or transfer stock from another branch.'
            : `Only ${i.productStock} units left, below the low stock level of ${i.reorderLevel} units. Reorder or request a transfer.`,
          meta: `${i.productStock} units in stock`,
          sort: 1
        })),
      ...scoped
        .filter((i) => i.expiringSoon && i.stock > 0)
        .map((i) => {
          const days = daysUntil(new Date(i.expiry))
          return {
            id: `exp-${i.key}-${i.batch}`,
            type: 'expiring',
            path: PATHS.inventory,
            branch: branchById(i.branchId),
            title: i.expired ? `Expired: ${i.name}` : `Expiring soon: ${i.name}`,
            message: `${i.stock} units in batch ${i.batch} ${days < 0 ? `expired ${-days} days ago` : days === 0 ? 'expire today' : `expire in ${days} ${days === 1 ? 'day' : 'days'}`}.`,
            meta: `Expires ${formatDate(new Date(i.expiry))}`,
            sort: 0
          }
        }),
      ...settings.tax.rates
        .filter((r) => r.status === 'Active')
        .map((r) => ({ rate: r, due: nextTaxDueDate(r) }))
        .filter(({ due }) => daysUntil(due) <= TAX_REMINDER_DAYS)
        .map(({ rate, due }) => {
          const days = daysUntil(due)
          return {
            id: `tax-${rate.id}-${due.getFullYear()}`,
            type: 'tax',
            path: PATHS.policy,
            branch: null,
            title: `${rate.name} due ${days === 0 ? 'today' : `in ${days} ${days === 1 ? 'day' : 'days'}`}`,
            message: `The yearly ${rate.name} (${Number(rate.rate)}%) must be paid to the government by ${formatDate(due)}.`,
            meta: `Due ${formatDate(due)}`,
            sort: 3
          }
        })
    ].sort((a, b) => a.sort - b.sort)
  }
)
