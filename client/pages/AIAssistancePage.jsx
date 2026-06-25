import { useSelector } from 'react-redux'
import { PageHeader } from '../components'
import { selectCurrentUser } from '../features/auth/store/authSlice'
import { SUGGESTED_QUESTIONS } from '../features/aiAssistance/model/suggestions'
import AssistantChat from '../features/aiAssistance/components/AssistantChat'
import './AIAssistancePage.css'

// AI Assistance (the Owner's only): a chat that answers from the business's figures
export default function AIAssistancePage() {
  const user = useSelector(selectCurrentUser)
  const scope = user?.branchName || 'All Branches'

  return (
    <div className="content-section-card ai-page">
      <PageHeader centered title={`AI Assistance · ${user?.roleLabel ?? ''}`} description={`Ask about ${scope === 'All Branches' ? 'every branch' : `${scope}'s`} figures.`} />
      <AssistantChat suggestions={SUGGESTED_QUESTIONS} storageKey={`ai-chat:${user?.id}`} />
    </div>
  )
}
