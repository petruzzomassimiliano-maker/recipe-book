import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore.js'
import { initiateDropboxLogin, exchangeDropboxCode, refreshDropboxToken } from '../services/auth.js'

/**
 * useAuth hook — exposes login/logout/callback handlers.
 * Wraps authStore with navigation + token refresh logic.
 */
export function useAuth() {
  const {
    jwt,
    dropboxToken,
    dropboxRefreshToken,
    user,
    isAuthenticated,
    isLoading,
    error,
    setAuth,
    setLoading,
    setError,
    logout: storeLogout,
    updateDropboxToken,
    isTokenExpiringSoon
  } = useAuthStore()

  const navigate = useNavigate()

  /**
   * Start Dropbox OAuth PKCE login flow.
   * Redirects user to Dropbox auth page.
   */
  const login = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await initiateDropboxLogin()
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }, [setLoading, setError])

  /**
   * Handle OAuth callback — exchange code for tokens.
   * Called from DropboxCallback page.
   */
  const handleCallback = useCallback(async (code) => {
    setLoading(true)
    setError(null)
    try {
      const data = await exchangeDropboxCode(code)
      setAuth(data)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message)
      setLoading(false)
      navigate('/login', { replace: true })
    }
  }, [setAuth, setLoading, setError, navigate])

  /**
   * Refresh Dropbox token if expiring soon.
   * Called automatically by app components.
   */
  const refreshToken = useCallback(async () => {
    if (!dropboxRefreshToken || !isTokenExpiringSoon()) return
    try {
      const data = await refreshDropboxToken(dropboxRefreshToken)
      updateDropboxToken(data.dropboxToken, data.expiresIn)
    } catch (err) {
      console.error('[useAuth] Token refresh failed:', err.message)
      // Force re-login on refresh failure
      await storeLogout()
      navigate('/login')
    }
  }, [dropboxRefreshToken, isTokenExpiringSoon, updateDropboxToken, storeLogout, navigate])

  /**
   * Logout: clear store + redirect to login.
   */
  const logout = useCallback(async () => {
    await storeLogout()
    navigate('/login', { replace: true })
  }, [storeLogout, navigate])

  return {
    jwt,
    dropboxToken,
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
    handleCallback,
    refreshToken,
    isSuperUser: user?.role === 'superUser'
  }
}
