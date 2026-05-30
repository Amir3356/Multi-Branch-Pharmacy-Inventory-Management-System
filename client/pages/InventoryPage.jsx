import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Plus } from 'lucide-react'
import { Notice } from '../components'
import { useBranchScope, useFormatMoney } from '../hooks'
import { selectInventory } from '../features/inventory/store/selectors'
import { selectProducts } from '../features/inventory/store/productsSlice'
import { selectProcurementCategories } from '../features/purchases/store/procurementCategoriesSlice'
import { loadProcurementCategories } from '../features/purchases/store/procurementCategoriesThunks'
import { selectCurrentUser } from '../features/auth/store/authSlice'
import { selectPurchases } from '../features/purchases/store/purchasesSlice'
import { findCatalogProduct } from '../utils'
import { editInventoryItem } from '../features/inventory/store/inventoryThunks'
import { addProcurementToStock } from '../features/purchases/store/purchasesThunks'
import { procurementBatch } from '../features/purchases/model/procurement'
import { selectTransfers } from '../features/transfers/store/transfersSlice'
import { receiveTransferToStock } from '../features/transfers/store/transfersThunks'
import InventoryTable from '../features/inventory/components/InventoryTable'
import EditInventoryModal from '../features/inventory/components/EditInventoryModal'
import ReceiveStockModal from '../features/inventory/components/ReceiveStockModal'
import './InventoryPage.css'

export default function InventoryPage() {
  const dispatch = useDispatch()
  const formatMoney = useFormatMoney()
  const { branches, branchById, isAllBranches, currentBranch, scopeLabel, inScope } = useBranchScope()
  const inventory = useSelector(selectInventory)
  const products = useSelector(selectProducts)
  // The category filter lists the categories the Procurement Officer added on the Category & Product page
  const procurementCategories = useSelector(selectProcurementCategories)
  const categories = procurementCategories.map((c) => c.name)
  const user = useSelector(selectCurrentUser)
  const purchases = useSelector(selectPurchases)
  // Staff work at their assigned branch; the Owner at the branch picked in the header
  const staffBranchId = user?.branchId && user.branchId !== 'all' ? user.branchId : null
  const addBranchId = staffBranchId || (isAllBranches ? null : currentBranch?.id)
  // Paid orders whose stock the branch hasn't added yet: Receive Stock puts them in stock
  const branchProcurements = purchases.filter((p) => p.status === 'Paid' && !p.receivedAt && (addBranchId ? p.branchId === addBranchId : true))
  // …and stock other branches sent here that hasn't been added yet
  const transfers = useSelector(selectTransfers)
  // What Receive Stock can add: paid orders and incoming transfers, in one shape. A transfer's expiry comes with the
  // stock (fixedExpiry), and its cost is the product's purchase price.
  const arrivals = [
    ...branchProcurements.map((p) => ({ ...p, kind: 'procurement', note: `${p.qty} units · ${p.supplier}` })),
    ...transfers
      .filter((t) => t.status === 'Pending' && (addBranchId ? t.to === addBranchId : true))
      .map((t) => {
        const unit = findCatalogProduct(products, t.medId, t.product)?.purchasePrice || 0
        return { ...t, kind: 'transfer', purchasePrice: unit, total: unit * t.qty, fixedExpiry: t.expiry, note: `transfer from ${branchById(t.from)?.name || t.from}` }
      })
  ]
  // Total Cost (from the Procurement page): what the order a batch arrived from cost in all, matched by its branch and
  // batch number. Stock that came by transfer, or older batches with no matching order, show "—".
  const orderTotalByBatch = new Map(
    purchases.filter((p) => p.receivedAt).map((p) => [`${p.branchId}|${procurementBatch(p)}`, p.total])
  )
  const inventoryRows = inventory
    .filter((item) => inScope(item.branchId))
    .map((item) => ({ ...item, procurementTotal: orderTotalByBatch.get(`${item.branchId}|${item.batch}`) }))
  const [showReceiveStock, setShowReceiveStock] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  // Only the branch's Inventory Officer adds received stock
  const isInventoryOfficer = user?.role === 'inventory_officer'
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    dispatch(loadProcurementCategories()).catch((error) => setNotice({ type: 'error', text: error.message }))
  }, [dispatch])

  // Adds the order's units to this branch's stock (on the server, so every screen gets them) and sets the selling price;
  // the form shows any error
  const handleReceiveStock = async (arrival, sellingPrice, packageDetails) => {
    const message = arrival.kind === 'transfer'
      ? await dispatch(receiveTransferToStock(arrival, sellingPrice))
      : await dispatch(addProcurementToStock(arrival, sellingPrice, packageDetails))
    setNotice({ type: 'success', text: message })
    setShowReceiveStock(false)
  }

  // A new selling price is saved on the server; the form shows any error
  const handleEdit = async (data) => {
    setNotice({ type: 'success', text: await dispatch(editInventoryItem(editingItem, data)) })
    setEditingItem(null)
  }



  return (
    <div className="content-section-card">
      <div className="section-header">
        <div style={{ flex: 1, textAlign: 'center' }}>
          <h2 className="page-title" style={{ textAlign: 'center' }}>Inventory · {scopeLabel}</h2>
          {!isAllBranches && (
            <p className="page-desc" style={{ textAlign: 'center' }}>
              Products and quantities held at {currentBranch?.name}.
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {isInventoryOfficer && (
            <button className="primary-action-btn" onClick={() => setShowReceiveStock(true)}>
              <Plus size={16} /> Receive Stock
            </button>
          )}
        </div>
      </div>

      <Notice notice={notice} onDismiss={() => setNotice(null)} />

      <InventoryTable
        data={inventoryRows}
        branches={branches}
        categories={categories}
        showBranch={isAllBranches}
        onEdit={setEditingItem}
      />

      {editingItem && (
        <EditInventoryModal item={editingItem} branchName={branchById(editingItem.branchId)?.name} formatMoney={formatMoney} onClose={() => setEditingItem(null)} onSave={handleEdit} />
      )}

      {showReceiveStock && (
        <ReceiveStockModal arrivals={arrivals} products={products} branchName={addBranchId ? branchById(addBranchId)?.name : 'All Branches'} formatMoney={formatMoney} onClose={() => setShowReceiveStock(false)} onSave={handleReceiveStock} />
      )}
    </div>
  )
}
