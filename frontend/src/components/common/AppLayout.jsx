import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Navbar from './Navbar.jsx'
import MobileTabBar from './MobileTabBar.jsx'
import OfflineBanner from './OfflineBanner.jsx'
import InstallPrompt from './InstallPrompt.jsx'
import KeepAwakeController from './KeepAwakeController.jsx'
import UnlockDialog from './UnlockDialog.jsx'
import TimerDock from './TimerDock.jsx'
import { useRecipeStore } from '../../store/recipeStore.js'
import { useAuthStore } from '../../store/authStore.js'
import { checkEditAccess, getAppStatus } from '../../services/auth.js'

/** App shell — no login: everyone gets in, the PIN only unlocks editing. */
export default function AppLayout() {
  const offlineFallback = useRecipeStore((s) => s.offlineFallback)

  useEffect(() => {
    const { setFamilyAppName, editToken, lock } = useAuthStore.getState()
    // Old multi-user session data is useless now
    try {
      localStorage.removeItem('recipe-book-auth')
      localStorage.removeItem('recipe-book-shopping')
    } catch {
      // ignore
    }
    getAppStatus()
      .then((s) => setFamilyAppName(s.familyAppName))
      .catch(() => {})
    if (editToken) {
      checkEditAccess()
        .then((ok) => {
          if (!ok) lock()
        })
        .catch(() => {})
    }
  }, [])

  return (
    <div className="min-h-dvh bg-surface flex flex-col">
      <KeepAwakeController />
      <Navbar />
      <OfflineBanner usingCache={offlineFallback} />
      <div className="flex-1 pb-[calc(4rem+env(safe-area-inset-bottom))] sm:pb-0">
        <Outlet />
      </div>
      <MobileTabBar />
      <InstallPrompt />
      <UnlockDialog />
      <TimerDock />
    </div>
  )
}
