import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, Lightbulb, Loader2, MessageSquare, RefreshCw, ShieldAlert, Sparkles, X } from 'lucide-react'
import { fetchAdvice } from '../../api/aiApi'
import { ADVISOR_ANALYSES, ADVISOR_STARTERS, SEVERITY_LABEL, SEVERITY_TONE } from '../../services/advisorPrompts'
import AssistantChat from '../../features/aiAssistance/components/AssistantChat'
import '../../pages/AIAssistancePage.css'
import './AdvisorSidebar.css'

const scopeKey = (scope) => `${scope.from}|${scope.to}|${scope.branchId || 'all'}`
const timeOf = (iso) => (iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '')

/**
 * The Owner's AI business advisor, beside the dashboard. It works on what the dashboard shows: `scope`
 * ({ from, to, branchId }) and its `scopeLabel` ("This month · All branches").
 *  - Insights: the AI's recommendations for that scope, plus audit events the system flagged by fixed rules.
 *  - Ask: a chat with one-tap analyses (financial summary, branch comparison, forecast, audit review, …).
 * Insights load once when first opened; after the period or branch changes they offer an update instead of calling the
 * AI on every change.
 */
export default function AdvisorSidebar({ id, scope, scopeLabel, userId, onClose }) {
  const [tab, setTab] = useState('insights')
  const [advice, setAdvice] = useState(null) // { key, label, data }
  // The first analysis starts as soon as the advisor opens
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const request = useRef(0)
  const key = scopeKey(scope)

  const load = useCallback(
    async (refresh = false) => {
      const id = ++request.current
      setLoading(true)
      setError(null)
      try {
        const { data } = await fetchAdvice(scope, { refresh })
        if (id === request.current) setAdvice({ key: scopeKey(scope), label: scopeLabel, data })
      } catch (e) {
        if (id === request.current) setError(e.message)
      } finally {
        if (id === request.current) setLoading(false)
      }
    },
    [scope, scopeLabel]
  )

  // When the advisor opens: analyse what the dashboard shows (state only changes once the answer arrives)
  const first = useRef({ scope, scopeLabel })
  useEffect(() => {
    const id = ++request.current
    const { scope: s, scopeLabel: label } = first.current
    fetchAdvice(s)
      .then(({ data }) => id === request.current && setAdvice({ key: scopeKey(s), label, data }))
      .catch((e) => id === request.current && setError(e.message))
      .finally(() => id === request.current && setLoading(false))
  }, [])

  const stale = advice && advice.key !== key
  const data = advice?.data

  return (
    // Escape closes it only while focus is inside, so it never fights a dialog elsewhere on the page
    <aside id={id} className="advisor-sidebar" aria-label="AI business advisor" onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <header className="advisor-header">
        <div>
          <h2>
            <Sparkles size={17} /> AI Business Advisor
          </h2>
          <p className="advisor-scope" title="The dashboard's period and branch">{scopeLabel}</p>
        </div>
        <button type="button" className="advisor-icon-btn" onClick={onClose} aria-label="Close the AI advisor">
          <X size={18} />
        </button>
      </header>

      <div className="advisor-tabs" role="tablist" aria-label="Advisor views">
        <button type="button" role="tab" id="advisor-tab-insights" aria-selected={tab === 'insights'} aria-controls="advisor-panel-insights" className={tab === 'insights' ? 'active' : ''} onClick={() => setTab('insights')}>
          <Lightbulb size={15} /> Insights
        </button>
        <button type="button" role="tab" id="advisor-tab-ask" aria-selected={tab === 'ask'} aria-controls="advisor-panel-ask" className={tab === 'ask' ? 'active' : ''} onClick={() => setTab('ask')}>
          <MessageSquare size={15} /> Ask &amp; analyse
        </button>
      </div>

      <div id="advisor-panel-insights" role="tabpanel" aria-labelledby="advisor-tab-insights" className="advisor-panel" hidden={tab !== 'insights'}>
        {stale && !loading && (
          <div className="advisor-stale">
            <span>These insights are for <strong>{advice.label}</strong>.</span>
            <button type="button" className="primary-action-btn advisor-small-btn" onClick={() => load()}>
              <RefreshCw size={14} /> Update for {scopeLabel}
            </button>
          </div>
        )}

        {loading && (
          <div className="advisor-loading" role="status">
            <Loader2 size={18} className="ai-spin" /> Analysing {scopeLabel}… this can take a few seconds.
          </div>
        )}

        {error && !loading && (
          <div className="advisor-error" role="alert">
            <p>{error}</p>
            <button type="button" className="secondary-action-btn advisor-small-btn" onClick={() => load()}>
              Try again
            </button>
          </div>
        )}

        {data && !loading && (
          <>
            {data.summary && <p className="advisor-summary">{data.summary}</p>}

            <section className="advisor-section" aria-labelledby="advisor-flags-title">
              <h3 id="advisor-flags-title">
                <ShieldAlert size={15} /> Flagged for review
                <span className="advisor-count">{data.flagCount ?? data.flags?.length ?? 0}</span>
              </h3>
              {data.flags?.length ? (
                <ul className="advisor-list">
                  {data.flags.map((f, i) => (
                    <li key={i} className={`advisor-flag severity-${f.severity}`}>
                      <div className="advisor-item-head">
                        <span className={`status-tag ${SEVERITY_TONE[f.severity]}`}>{SEVERITY_LABEL[f.severity]}</span>
                        <span className="advisor-category">{f.type}</span>
                      </div>
                      <p className="advisor-item-title">{f.what}</p>
                      <p className="advisor-item-detail">{f.why}</p>
                      {(f.when || f.by) && <p className="advisor-item-meta">{[f.when, f.by].filter(Boolean).join(' · ')}</p>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="advisor-empty">Nothing unusual in the audit trail for this period.</p>
              )}
            </section>

            <section className="advisor-section" aria-labelledby="advisor-recs-title">
              <h3 id="advisor-recs-title">
                <Lightbulb size={15} /> Recommendations
              </h3>
              {data.recommendations?.length ? (
                <ul className="advisor-list">
                  {data.recommendations.map((r, i) => (
                    <li key={i} className={`advisor-rec severity-${r.priority}`}>
                      <div className="advisor-item-head">
                        <span className={`status-tag ${SEVERITY_TONE[r.priority]}`}>{SEVERITY_LABEL[r.priority]}</span>
                        <span className="advisor-category">{r.category}</span>
                      </div>
                      <p className="advisor-item-title">{r.title}</p>
                      {r.detail && <p className="advisor-item-detail">{r.detail}</p>}
                      {r.action && <p className="advisor-action">→ {r.action}</p>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="advisor-empty">No recommendations: the figures are too thin to judge yet, or nothing needs action.</p>
              )}
            </section>

            <footer className="advisor-footer">
              <span>
                {data.cached ? 'Saved analysis from' : 'Analysed at'} {timeOf(data.generatedAt)}
              </span>
              <button type="button" className="link-btn" onClick={() => load(true)}>
                <RefreshCw size={13} /> Re-analyse
              </button>
            </footer>
            <p className="advisor-note">
              <AlertTriangle size={12} /> AI advice can be wrong. Flags come from fixed rules and are reasons to look, not proof of wrongdoing.
            </p>
          </>
        )}
      </div>

      <div id="advisor-panel-ask" role="tabpanel" aria-labelledby="advisor-tab-ask" className="advisor-panel advisor-panel-chat" hidden={tab !== 'ask'}>
        <AssistantChat compact title="Ask your advisor" scope={scope} storageKey={`ai-advisor:${userId}`} suggestions={ADVISOR_STARTERS} quickActions={ADVISOR_ANALYSES} />
      </div>
    </aside>
  )
}
