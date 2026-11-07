import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { useBranchScope } from '../hooks'
import { selectAllNotifications } from '../features/notifications/store/selectors'
import { allMarkedRead, dismissed, dismissedRestored, markedRead, readToggled, selectNotificationState } from '../features/notifications/store/notificationsSlice'
import NotificationsPanel from '../features/notifications/components/NotificationsPanel'
import './NotificationsPage.css'

// Not in the sidebar; reachable at /notifications
export default function NotificationsPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { scopeLabel } = useBranchScope()
  const all = useSelector(selectAllNotifications)
  const state = useSelector(selectNotificationState)
  const notifications = all.filter((n) => !state.dismissed.includes(n.id))

  return (
    <NotificationsPanel
      notifications={notifications}
      readIds={state.read}
      scopeLabel={scopeLabel}
      dismissedCount={all.length - notifications.length}
      onToggleRead={(id) => dispatch(readToggled(id))}
      onMarkAllRead={() => dispatch(allMarkedRead(notifications.map((n) => n.id)))}
      onDismiss={(id) => dispatch(dismissed(id))}
      onRestoreDismissed={() => dispatch(dismissedRestored(all.map((n) => n.id)))}
      onOpen={(n) => {
        dispatch(markedRead(n.id))
        navigate(n.path)
      }}
    />
  )
}
