import { BranchTag, EmptyRow, StatusTag } from '../../../components'

// A list of stock transfers. `show` picks the branch columns: 'both' (From and To), 'to' (outgoing, where it went) or
// 'from' (incoming, where it came from)
export default function TransfersTable({ transfers, products, branchById, show = 'both', emptyText }) {
  const columns = 7 + (show === 'both' ? 2 : 1)

  return (
    <div className="table-responsive" style={{ marginTop: '1rem' }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>Transfer ID</th>
            {show !== 'to' && <th>From</th>}
            {show !== 'from' && <th>To</th>}
            <th>Category</th>
            <th>Product Name</th>
            <th>Batch</th>
            <th>Quantity</th>
            <th>Date</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {transfers.map((trf) => (
            <tr key={trf.id}>
              <td className="font-mono">{trf.id}</td>
              {show !== 'to' && <td><BranchTag branch={branchById(trf.from)} /></td>}
              {show !== 'from' && <td><BranchTag branch={branchById(trf.to)} /></td>}
              <td>{products.find((m) => m.name === trf.product)?.category || '—'}</td>
              <td className="fw-600">{trf.product}</td>
              <td>
                {/* Incoming: the batch it was added under here, with the sender's batch for tracing */}
                <span className="batch-badge">{show === 'from' && trf.receivedBatch ? trf.receivedBatch : trf.batch}</span>
                {show === 'from' && trf.receivedBatch && trf.receivedBatch !== trf.batch && <div className="page-desc" style={{ margin: 0 }}>Sent as {trf.batch}</div>}
                {show === 'to' && trf.receivedBatch && trf.receivedBatch !== trf.batch && <div className="page-desc" style={{ margin: 0 }}>Received as {trf.receivedBatch}</div>}
              </td>
              <td>{trf.qty} units</td>
              <td>{trf.date}</td>
              <td>
                <StatusTag status={trf.status} />
              </td>
            </tr>
          ))}
          {transfers.length === 0 && <EmptyRow colSpan={columns}>{emptyText}</EmptyRow>}
        </tbody>
      </table>
    </div>
  )
}
