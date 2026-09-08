import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore.js'

/**
 * AuthGuard — wraps protected routes.
 * Redirects to /login if not authenticated.
 */
export default function AuthGuard({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return children
}
