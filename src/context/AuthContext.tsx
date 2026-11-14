import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import type { AuthUser } from '../types'
import { authApi, setUnauthorizedHandler } from '../lib/api'

interface AuthContextValue {
  user: AuthUser | null
  session: { user: AuthUser } | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  requestPasswordReset: (email: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    authApi
      .me()
      .then((data) => {
        if (!cancelled) {
          setUser(data.user)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUser(null)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    // When an authenticated API call receives a 401, clear local user state
    // so ProtectedRoute seamlessly redirects to /login without a hard reload
    setUnauthorizedHandler(() => {
      setUser(null)
    })

    return () => {
      setUnauthorizedHandler(null)
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    const data = await authApi.login(email, password)
    setUser(data.user)
  }

  const signUp = async (email: string, password: string) => {
    const data = await authApi.register(email, password)
    setUser(data.user)
  }

  const requestPasswordReset = async (email: string) => {
    await authApi.forgotPassword(email)
  }

  const signOut = async () => {
    try {
      await authApi.logout()
    } catch {
      // Ignore logout errors; always clear local user state
    } finally {
      setUser(null)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session: user ? { user } : null,
        loading,
        signIn,
        signUp,
        requestPasswordReset,
        signOut
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
