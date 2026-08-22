import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import pb from '@/lib/pocketbase/client'
import { Rota } from '@/types/database'
import { useRealtime } from '@/hooks/use-realtime'

interface RotasContextType {
  rotas: Rota[]
  loading: boolean
}

const RotasContext = createContext<RotasContextType | undefined>(undefined)

export function useRotas() {
  const ctx = useContext(RotasContext)
  if (!ctx) throw new Error('useRotas must be used within a RotasProvider')
  return ctx
}

export function RotasProvider({ children }: { children: ReactNode }) {
  const [rotas, setRotas] = useState<Rota[]>([])
  const [loading, setLoading] = useState(true)

  const loadRotas = async () => {
    try {
      const list = await pb.collection('rotas').getFullList<Rota>({ sort: 'ordem,nome' })
      setRotas(list)
    } catch {
      /* intentionally ignored */
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRotas()
  }, [])

  useRealtime('rotas', () => loadRotas())

  return <RotasContext.Provider value={{ rotas, loading }}>{children}</RotasContext.Provider>
}
