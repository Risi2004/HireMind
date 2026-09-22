import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * Route guard for candidate pages (Dashboard, Profile, Interviews).
 * If the authenticated user is an administrator, redirects them to /admin/dashboard
 * to ensure admin accounts only access the admin management portal.
 */
export default function CandidateProtectedRoute({ children }) {
  const { user, token, isAdmin } = useAuth()

  if (token && user && isAdmin) {
    return <Navigate to="/admin/dashboard" replace />
  }

  return children ? children : <Outlet />
}
