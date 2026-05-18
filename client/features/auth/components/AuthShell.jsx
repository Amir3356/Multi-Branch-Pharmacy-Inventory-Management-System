import { Activity, CheckCircle2, Pill, ShieldCheck } from 'lucide-react'
import '../../../pages/LoginPage.css'

const FEATURES = ['Real-Time Stock Across Every Branch', 'Low-Stock & Expiry Alerts for Perishables', 'Audit logs']

// Branding panel on the left, the page's form on the right. Shared by every sign-in page.
export default function AuthShell({ title, subtitle, children }) {
  return (
    <div className="login-wrapper">
      <div className="brand-section">
        <div className="brand-grid-pattern"></div>

        <div className="brand-header">
          <div className="brand-logo">
            <div className="logo-icon-wrapper">
              <Pill size={24} />
            </div>
            <span className="logo-text">SuperMart IMS</span>
          </div>
          <div className="badge-tag">
            <Activity size={14} /> Inventory v2.4 Active
          </div>
        </div>

        <div className="brand-body">
          <h1 className="brand-title">Multi-Branch Supermarket</h1>
          <p className="brand-desc">
            Manage your product catalog, track stock at every branch, move goods between branches, and keep purchasing and sales in one place.
          </p>

          <div className="feature-list">
            {FEATURES.map((feature) => (
              <div className="feature-item" key={feature}>
                <div className="feature-icon">
                  <CheckCircle2 size={15} />
                </div>
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="brand-footer">
          <span>© 2026 SuperMart IMS</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <ShieldCheck size={14} /> Encrypted Portal
          </span>
        </div>
      </div>

      <div className="form-section">
        <div className="form-header">
          <div className="mobile-logo">
            <div className="logo-icon-wrapper">
              <Pill size={22} />
            </div>
            <span className="logo-text">SuperMart IMS</span>
          </div>

          <h2 className="form-title">{title}</h2>
          {subtitle && <p className="form-subtitle">{subtitle}</p>}
        </div>

        {children}

        <div className="security-footer">
          <ShieldCheck size={14} /> 256-Bit TLS Secured Connection
        </div>
      </div>
    </div>
  )
}
