import { Provider } from 'react-redux'
import { Toaster } from 'sonner'
import { store } from './redux/store'
import AppRouter from './routes/AppRouter'

// App shell: the Redux store around the router, and the toast area every page's notices show in (gone after 3 seconds)
export default function App() {
  return (
    <Provider store={store}>
      <AppRouter />
      <Toaster position="top-right" duration={3000} richColors closeButton />
    </Provider>
  )
}
