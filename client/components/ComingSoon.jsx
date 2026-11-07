import { Clock } from 'lucide-react'

export default function ComingSoon({ feature, description }) {
  return (
    <div className="content-section-card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
      <div style={{ display: 'inline-flex', padding: '1rem', borderRadius: '50%', background: 'rgba(31, 122, 77, 0.12)', color: 'var(--primary-cyan)', marginBottom: '1rem' }}>
        <Clock size={36} />
      </div>
      <h2 className="page-title" style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>Coming Soon</h2>
      <p className="page-desc" style={{ maxWidth: '420px', margin: '0 auto' }}>
        The {feature} feature is currently under development. {description}
      </p>
    </div>
  )
}
