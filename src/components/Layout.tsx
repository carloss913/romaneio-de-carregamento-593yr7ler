import { useState } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { Truck, Home, Package, Menu, X, LogOut, ChevronRight, Plus } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { ROTAS } from '@/types/database'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { NovoRomaneioModal } from './NovoRomaneioModal'

export default function Layout() {
  const { user, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [logoutModalOpen, setLogoutModalOpen] = useState(false)
  const [novoRomaneioOpen, setNovoRomaneioOpen] = useState(false)

  const handleLogout = () => {
    signOut()
    navigate('/login')
  }

  const navContent = (
    <div className="flex flex-col h-full">
      {/* Top Branding */}
      <div className="p-5 border-b border-slate-800 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/30">
          <Truck className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-base font-black tracking-tight text-white leading-tight">
            Catálogo Carga
          </h1>
          <p className="text-xs text-slate-400 font-medium">Gestão de Camions</p>
        </div>
      </div>

      {/* Nav Menu */}
      <div className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
        <div className="space-y-1">
          <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
            Geral
          </p>
          <Link
            to="/"
            onClick={() => setMobileMenuOpen(false)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
              location.pathname === '/'
                ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Home className="w-4 h-4" />
            <span>Início</span>
          </Link>

          <Link
            to="/produtos"
            onClick={() => setMobileMenuOpen(false)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
              location.pathname === '/produtos'
                ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Produtos</span>
          </Link>
        </div>

        {/* Rotas */}
        <div className="space-y-1">
          <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
            Rotas Ativas
          </p>
          {ROTAS.map((r) => {
            const path = `/rotas/${encodeURIComponent(r.name)}`
            const isActive = location.pathname === path
            return (
              <Link
                key={r.name}
                to={path}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-slate-800 text-white font-semibold'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: r.color }} />
                  <span>{r.name}</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
              </Link>
            )
          })}
        </div>

        {/* Quick Action in Sidebar */}
        <div className="pt-2">
          <Button
            type="button"
            onClick={() => setNovoRomaneioOpen(true)}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-xl py-2.5 text-sm font-semibold shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Romaneio</span>
          </Button>
        </div>
      </div>

      {/* User Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/50 flex items-center justify-between">
        <div className="flex items-center gap-2.5 truncate">
          <div className="w-8 h-8 rounded-full bg-slate-800 text-orange-400 font-bold flex items-center justify-center text-xs border border-slate-700">
            {user?.name?.[0] || user?.email?.[0] || 'C'}
          </div>
          <div className="truncate">
            <p className="text-xs font-semibold text-slate-200 truncate">
              {user?.name || 'Operador'}
            </p>
            <p className="text-[10px] text-slate-400 truncate">{user?.email}</p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setLogoutModalOpen(true)}
          className="text-slate-400 hover:text-red-400 hover:bg-slate-800 h-8 w-8"
        >
          <LogOut className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row print:bg-white">
      {/* Desktop Sidebar */}
      <aside className="hidden md:block w-64 bg-slate-900 shrink-0 fixed inset-y-0 left-0 z-30 print:hidden">
        {navContent}
      </aside>

      {/* Mobile Topbar */}
      <header className="md:hidden sticky top-0 z-40 bg-slate-900 text-white p-3 flex items-center justify-between shadow-md print:hidden">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(true)}
            className="text-white hover:bg-slate-800"
          >
            <Menu className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-orange-500 flex items-center justify-center text-white">
              <Truck className="w-4 h-4" />
            </div>
            <span className="font-bold text-sm">Catálogo Carga</span>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => setNovoRomaneioOpen(true)}
          className="bg-orange-500 hover:bg-orange-600 text-white h-8 text-xs font-bold rounded-lg"
        >
          + Romaneio
        </Button>
      </header>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex print:hidden">
          <div
            className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-64 bg-slate-900 h-full z-10 shadow-2xl">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(false)}
              className="absolute top-3 right-3 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </Button>
            {navContent}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 md:pl-64 min-h-screen flex flex-col">
        <div className="max-w-6xl w-full mx-auto p-4 md:p-8 flex-1">
          <Outlet />
        </div>
      </main>

      {/* Logout Confirmation Dialog */}
      <Dialog open={logoutModalOpen} onOpenChange={setLogoutModalOpen}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>Sair do Sistema?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-500 py-2">
            Tem certeza que deseja encerrar sua sessão no Catálogo de Carregamento?
          </p>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setLogoutModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" variant="destructive" onClick={handleLogout}>
              Sair Agora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <NovoRomaneioModal open={novoRomaneioOpen} onOpenChange={setNovoRomaneioOpen} />
    </div>
  )
}
