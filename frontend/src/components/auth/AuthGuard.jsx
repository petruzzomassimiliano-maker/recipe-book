import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore.js'
import Navbar from '../common/Navbar.jsx'
import MobileTabBar from '../common/MobileTabBar.jsx'
import OfflineBanner from '../common/OfflineBanner.jsx'
import InstallPrompt from '../common/InstallPrompt.jsx'
import { useRecipeStore } from '../../store/recipeStore.js'

export default function AuthGuard() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const mustChangePassword = useAuthStore((s) => s.mustChangePassword)
  const offlineFallback = useRecipeStore((s) => s.offlineFallback)

  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (mustChangePassword) return <Navigate to="/change-password" replace />

  return (
    <div className="min-h-dvh bg-surface flex flex-col">
      <Navbar />
      <OfflineBanner usingCache={offlineFallback} />
      <div className="flex-1 pb-[calc(3.75rem+env(safe-area-inset-bottom))] sm:pb-0">
        <Outlet />
      </div>
      <MobileTabBar />
      <InstallPrompt />
    </div>
  )
}
