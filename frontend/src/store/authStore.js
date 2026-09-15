import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { logoutFromWorker } from '../services/auth.js'

/**
 * Auth store — JWT app user (family Dropbox is server-side).
 */
export const useAuthStore = create(
  persist(
    (set) => ({
      jwt: null,
      user: null,
      familyAppName: 'Recipe Book',
      isAuthenticated: false,
      isLoading: false,
      error: null,
      mustChangePassword: false,
      setupEnvHint: null,

      setAuth: ({ jwt, user, familyAppName, mustChangePassword }) => {
        set({
          jwt,
          user,
          familyAppName: familyAppName || 'Recipe Book',
          mustChangePassword: Boolean(mustChangePassword ?? user?.mustChangePassword),
          isAuthenticated: true,
          isLoading: false,
          error: null
        })
      },

      setUser: (user) => set({ user }),
      setFamilyAppName: (familyAppName) => set({ familyAppName }),
      setMustChangePassword: (mustChangePassword) => set({ mustChangePassword }),
      setSetupEnvHint: (setupEnvHint) => set({ setupEnvHint }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),

      logout: async () => {
        await logoutFromWorker()
        set({
          jwt: null,
          user: null,
          familyAppName: 'Recipe Book',
          isAuthenticated: false,
          mustChangePassword: false,
          setupEnvHint: null,
          error: null
        })
      }
    }),
    {
      name: 'recipe-book-auth',
      partialize: (state) => ({
        jwt: state.jwt,
        user: state.user,
        familyAppName: state.familyAppName,
        isAuthenticated: state.isAuthenticated,
        mustChangePassword: state.mustChangePassword
      })
    }
  )
)
