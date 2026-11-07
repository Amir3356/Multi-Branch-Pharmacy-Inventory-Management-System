import { Outlet } from 'react-router-dom'

// Full-screen background for the sign-in page
export default function AuthLayout() {
  return (
    <div className="app-container">
      <div className="ambient-orb orb-1"></div>
      <div className="ambient-orb orb-2"></div>
      <div className="ambient-orb orb-3"></div>
      <Outlet />
    </div>
  )
}
