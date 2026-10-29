import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import { auth } from '../lib/firebase'

interface AuthContextValue {
  user: User | null
  // true trong lúc Firebase đang khôi phục phiên đăng nhập cũ
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (displayName: string, email: string, password: string) => Promise<void>
  resetPassword: (email: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function requireAuth() {
  if (!auth) throw new Error('Firebase chưa được cấu hình')
  return auth
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(Boolean(auth))
  const [, setRefreshTick] = useState(0)

  useEffect(() => {
    if (!auth) return
    return onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
    })
  }, [])

  const value: AuthContextValue = {
    user,
    loading,
    login: async (email, password) => {
      await signInWithEmailAndPassword(requireAuth(), email, password)
    },
    register: async (displayName, email, password) => {
      const cred = await createUserWithEmailAndPassword(requireAuth(), email, password)
      await updateProfile(cred.user, { displayName })
      // updateProfile sửa trực tiếp object user, cần render lại để hiện tên mới
      setRefreshTick((t) => t + 1)
    },
    resetPassword: async (email) => {
      await sendPasswordResetEmail(requireAuth(), email)
    },
    logout: async () => {
      await signOut(requireAuth())
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth phải được dùng bên trong AuthProvider')
  return ctx
}
