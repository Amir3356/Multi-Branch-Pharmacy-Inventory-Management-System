// "Nothing here yet" row for an empty table
export default function EmptyRow({ colSpan, children }) {
  return (
    <tr>
      <td colSpan={colSpan} style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '2rem' }}>
        {children}
      </td>
    </tr>
  )
}
