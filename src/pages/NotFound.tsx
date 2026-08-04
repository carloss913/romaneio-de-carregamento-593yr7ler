import { useLocation, Link } from 'react-router-dom'
import { useEffect } from 'react'

export default function NotFound() {
  const location = useLocation()

  useEffect(() => {
    console.error('404 Error: Página não encontrada:', location.pathname)
  }, [location.pathname])

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white p-4">
      <div className="text-center space-y-4">
        <h1 className="text-6xl font-black text-orange-500">404</h1>
        <p className="text-xl font-bold text-slate-200">Página Não Encontrada</p>
        <p className="text-sm text-slate-400">
          A rota que você tentou acessar não existe no catálogo.
        </p>
        <Link
          to="/"
          className="inline-block bg-orange-500 hover:bg-orange-600 text-white font-bold px-6 py-2.5 rounded-xl text-sm"
        >
          Voltar ao Início
        </Link>
      </div>
    </div>
  )
}
