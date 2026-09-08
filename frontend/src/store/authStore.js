import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { logoutFromWorker } from '../services/auth.js'

/**
 * Zustand auth store — persisted to localStorage.
 * Holds JWT, Dropbox token, user info, and auth state.
 */
export const useAuthStore = create(
  persist(
    (set, get) => ({
      jwt: null,
      dropboxToken: null,
      dropboxRefreshToken: null,
      tokenExpiresAt: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      /**
       * Set auth state after successful OAuth exchange.
       */
      setAuth: ({ jwt, dropboxToken, dropboxRefreshToken, tokenExpiresIn, user }) => {
        const expiresAt = tokenExpiresIn
          ? Date.now() + tokenExpiresIn * 1000
          : null
        set({
          jwt,
          dropboxToken,
          dropboxRefreshToken: dropboxRefreshToken || null,
          tokenExpiresAt: expiresAt,
          user,
          isAuthenticated: true,
          isLoading: false,
          error: null
        })
      },

      /**
       * Update Dropbox token after refresh.
       */
      updateDropboxToken: (newToken, expiresIn) => {
        set({
          dropboxToken: newToken,
          tokenExpiresAt: Date.now() + (expiresIn || 14400) * 1000
        })
      },

      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),

      /**
       * Clear all auth state and call Worker logout.
       */
      logout: async () => {
        await logoutFromWorker()
        set({
          jwt: null,
          dropboxToken: null,
          dropboxRefreshToken: null,
          tokenExpiresAt: null,
          user: null,
          isAuthenticated: false,
          error: null
        })
      },

      /**
       * Check if Dropbox token needs refresh (refresh 5 min before expiry).
       */
      isTokenExpiringSoon: () => {
        const { tokenExpiresAt } = get()
        if (!tokenExpiresAt) return false
        return tokenExpiresAt - Date.now() < 5 * 60 * 1000 // 5 min buffer
      }
    }),
    {
      name: 'recipe-book-auth',
      // Only persist these fields (not loading/error)
      partialize: (state) => ({
        jwt: state.jwt,
        dropboxToken: state.dropboxToken,
        dropboxRefreshToken: state.dropboxRefreshToken,
        tokenExpiresAt: state.tokenExpiresAt,
        user: state.user,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
)
