import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import pb from '@/lib/pocketbase/client'

interface AuthContextType {
  user: any
  isAuthenticated: boolean
  signUp: (email: string, password: string) => Promise<{ error: any }>
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signOut: () => void
  loading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<any>(pb.authStore.isValid ? pb.authStore.record : null)
  const [isAuthenticated, setIsAuthenticated] = useState(pb.authStore.isValid)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = pb.authStore.onChange((_token, record) => {
      setUser(pb.authStore.isValid ? record : null)
      setIsAuthenticated(pb.authStore.isValid)
    })
    if (pb.authStore.isValid) {
      pb.collection('users')
        .authRefresh()
        .catch((err: any) => {
          // Só limpa a sessão se for erro definitivo de autenticação (ex.: 401 token inválido/expirado).
          // Se for 403 (permissão de collection/rota), 429 (rate limit) ou erro de rede (status 0 / timeout),
          // NÃO desloga o usuário da sessão existente, evitando expulsão indevida para /login.
          const status = Number(err?.status || err?.response?.code) || 0
          if (status === 401) {
            pb.authStore.clear()
          } else {
            console.warn(
              '[useAuth] Falha no authRefresh não-crítica (mantendo sessão local):',
              status,
              err,
            )
          }
        })
        .finally(() => setLoading(false))
    } else {
      if (pb.authStore.record) pb.authStore.clear()
      setLoading(false)
    }
    return () => {
      unsubscribe()
    }
  }, [])

  const signUp = async (email: string, password: string) => {
    try {
      await pb.collection('users').create({ email, password, passwordConfirm: password })
      await pb.collection('users').authWithPassword(email, password)
      return { error: null }
    } catch (error) {
      return { error }
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      await pb.collection('users').authWithPassword(email, password)
      return { error: null }
    } catch (error) {
      return { error }
    }
  }

  const signOut = () => {
    pb.authStore.clear()
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, signUp, signIn, signOut, loading }}>
      {children}
    </AuthContext.Provider>
  )
}
