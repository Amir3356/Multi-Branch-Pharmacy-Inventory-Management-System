// Page title, description and optional action button(s) on the right
export default function PageHeader({ title, description, centered, children }) {
  if (centered) {
    return (
      <div className="section-header" style={{ display: 'grid', gridTemplateColumns: children ? '1fr auto' : '1fr', alignItems: 'center', gap: '1rem', width: '100%' }}>
        <div style={{ textAlign: 'center' }}>
          <h2 className="page-title" style={{ textAlign: 'center' }}>{title}</h2>
          {description && <p className="page-desc" style={{ textAlign: 'center' }}>{description}</p>}
        </div>
        {children && <div style={{ justifySelf: 'end' }}>{children}</div>}
      </div>
    )
  }
  return (
    <div className="section-header">
      <div>
        <h2 className="page-title">{title}</h2>
        {description && <p className="page-desc">{description}</p>}
      </div>
      {children}
    </div>
  )
}
