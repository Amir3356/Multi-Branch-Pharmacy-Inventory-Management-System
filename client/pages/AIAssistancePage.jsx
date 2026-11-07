import { useSelector } from 'react-redux'
import { PageHeader } from '../components'
import { selectCurrentUser } from '../features/auth/store/authSlice'
import { suggestionsFor } from '../features/aiAssistance/model/suggestions'
import AssistantChat from '../features/aiAssistance/components/AssistantChat'
import './AIAssistancePage.css'

// AI Assistance: a chat that answers from the data the signed-in role can see
export default function AIAssistancePage() {
  const user = useSelector(selectCurrentUser)
  const scope = user?.branchName || 'All Branches'

  return (
    <div className="content-section-card ai-page">
      <PageHeader title={`AI Assistance · ${user?.roleLabel ?? ''}`} description={`Ask about ${scope === 'All Branches' ? 'every branch' : `${scope}'s`} figures.`} />
      <AssistantChat suggestions={suggestionsFor(user?.role)} storageKey={`ai-chat:${user?.id}`} />
    </div>
  )
}
