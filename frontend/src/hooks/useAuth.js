import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore.js'
import {
  loginWithPassword,
  changePassword as changePasswordApi,
  initiateFamilyDropboxSetup,
  completeFamilyDropboxSetup,
  importFamilyRefreshToken,
  createOwnerAccount,
  getAuthStatus
} from '../services/auth.js'

export function useAuth() {
  const {
    jwt,
    user,
    familyAppName,
    isAuthenticated,
    isLoading,
    error,
    mustChangePassword,
    setupEnvHint,
    setAuth,
    setLoading,
    setError,
    setMustChangePassword,
    setSetupEnvHint,
    logout: storeLogout
  } = useAuthStore()

  const navigate = useNavigate()

  const login = useCallback(
    async (username, password) => {
      setLoading(true)
      setError(null)
      try {
        const data = await loginWithPassword(username, password)
        setAuth({
          jwt: data.jwt,
          user: data.user,
          familyAppName: data.familyAppName,
          mustChangePassword: data.mustChangePassword
        })
        if (data.mustChangePassword) {
          navigate('/change-password', { replace: true })
        } else {
          navigate('/', { replace: true })
        }
      } catch (err) {
        setError(err.message)
        setLoading(false)
        throw err
      }
    },
    [setAuth, setLoading, setError, navigate]
  )

  const changePassword = useCallback(
    async (currentPassword, newPassword) => {
      setLoading(true)
      setError(null)
      try {
        const data = await changePasswordApi(currentPassword, newPassword, jwt)
        setAuth({
          jwt: data.jwt,
          user: data.user,
          familyAppName,
          mustChangePassword: false
        })
        setMustChangePassword(false)
        navigate('/', { replace: true })
      } catch (err) {
        setError(err.message)
        setLoading(false)
        throw err
      }
    },
    [jwt, familyAppName, setAuth, setLoading, setError, setMustChangePassword, navigate]
  )

  const startFamilySetup = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await initiateFamilyDropboxSetup({ forceReapprove: true })
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }, [setLoading, setError])

  const finishDropboxSetup = useCallback(
    async (code) => {
      setLoading(true)
      setError(null)
      try {
        const data = await completeFamilyDropboxSetup(code)
        if (data.envHint) setSetupEnvHint(data.envHint)
        setLoading(false)
        navigate('/setup/owner', { replace: true })
      } catch (err) {
        setError(err.message)
        setLoading(false)
        navigate('/setup', { replace: true })
      }
    },
    [setLoading, setError, setSetupEnvHint, navigate]
  )

  const importExistingDropbox = useCallback(
    async (refreshToken) => {
      setLoading(true)
      setError(null)
      try {
        const data = await importFamilyRefreshToken(refreshToken)
        if (data.envHint) setSetupEnvHint(data.envHint)
        setLoading(false)
        navigate('/setup/owner', { replace: true })
      } catch (err) {
        setError(err.message)
        setLoading(false)
        throw err
      }
    },
    [setLoading, setError, setSetupEnvHint, navigate]
  )

  const completeOwnerSetup = useCallback(
    async (payload) => {
      setLoading(true)
      setError(null)
      try {
        const data = await createOwnerAccount(payload)
        setAuth({
          jwt: data.jwt,
          user: data.user,
          familyAppName: data.familyAppName,
          mustChangePassword: false
        })
        if (data.envHint) setSetupEnvHint(data.envHint)
        navigate('/', { replace: true })
      } catch (err) {
        setError(err.message)
        setLoading(false)
        throw err
      }
    },
    [setAuth, setLoading, setError, setSetupEnvHint, navigate]
  )

  const logout = useCallback(async () => {
    await storeLogout()
    navigate('/login', { replace: true })
  }, [storeLogout, navigate])

  const role = user?.role
  return {
    jwt,
    user,
    familyAppName,
    isAuthenticated,
    isLoading,
    error,
    mustChangePassword,
    setupEnvHint,
    login,
    logout,
    changePassword,
    startFamilySetup,
    finishDropboxSetup,
    importExistingDropbox,
    completeOwnerSetup,
    getAuthStatus,
    isOwner: role === 'owner',
    isAdmin: role === 'admin' || role === 'owner',
    isStaff: role === 'admin' || role === 'owner'
  }
}
