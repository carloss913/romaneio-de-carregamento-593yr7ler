import { useParams, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import PublicLoading from './PublicLoading'

export default function RomaneioView() {
  const { id } = useParams<{ id: string }>()
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-slate-50"
        translate="no"
        lang="pt-BR"
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Carregando...</p>
        </div>
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate to={`/admin/romaneios/${id}`} replace />
  }

  return (
    <div translate="no" lang="pt-BR" className="notranslate">
      <PublicLoading />
    </div>
  )
}
