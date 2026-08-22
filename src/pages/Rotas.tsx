import { useEffect, useMemo, useState } from 'react'
import { Plus, Search, Edit2, Trash2, Route as RouteIcon } from 'lucide-react'
import { Rota } from '@/types/database'
import { getRotas, deleteRota } from '@/services/rotas'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table'
import { RotaModal } from '@/components/RotaModal'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'

export default function Rotas() {
  const { toast } = useToast()
  const [rotas, setRotas] = useState<Rota[]>([])
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedRota, setSelectedRota] = useState<Rota | null>(null)

  const loadData = async () => {
    try {
      const list = await getRotas()
      setRotas(list)
    } catch {
      /* intentionally ignored */
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useRealtime('rotas', () => loadData())

  const filtered = useMemo(() => {
    return rotas.filter((r) => r.nome.toLowerCase().includes(search.toLowerCase()))
  }, [rotas, search])

  const handleDelete = async (r: Rota) => {
    if (
      !confirm(
        `Tem certeza que deseja excluir a rota "${r.nome}"? Romaneios existentes não serão excluídos, mas não terão mais esta rota disponível.`,
      )
    ) {
      return
    }
    try {
      await deleteRota(r.id)
      toast({ title: 'Rota excluída', description: `A rota ${r.nome} foi removida.` })
      loadData()
    } catch (err: any) {
      toast({
        title: 'Erro ao excluir rota',
        description: err?.message || 'Não foi possível excluir.',
        variant: 'destructive',
      })
    }
  }

  const nextOrdem = rotas.length

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">
            Rotas de Carregamento
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Cadastre e gerencie as rotas disponíveis para os romaneios
          </p>
        </div>
        <Button
          onClick={() => {
            setSelectedRota(null)
            setModalOpen(true)
          }}
          className="bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl shadow-md shadow-orange-500/20"
        >
          <Plus className="w-4 h-4 mr-2" /> Nova Rota
        </Button>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome..."
          className="pl-9 bg-white rounded-xl border-slate-200"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="w-12">Cor</TableHead>
              <TableHead>Rota</TableHead>
              <TableHead className="text-center">Ordem</TableHead>
              <TableHead className="text-center">Situação</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-slate-400">
                  {rotas.length === 0 ? (
                    <span className="flex flex-col items-center gap-2">
                      <RouteIcon className="w-10 h-10 text-slate-300" />
                      Nenhuma rota cadastrada. Clique em "Nova Rota" para começar.
                    </span>
                  ) : (
                    'Nenhuma rota encontrada.'
                  )}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow key={r.id} className={!r.ativa ? 'opacity-50' : ''}>
                  <TableCell>
                    <div
                      className="w-6 h-6 rounded-full border border-slate-200"
                      style={{ backgroundColor: r.cor || '#78716c' }}
                    />
                  </TableCell>
                  <TableCell className="font-bold text-slate-800">{r.nome}</TableCell>
                  <TableCell className="text-center font-medium tabular-nums">
                    {r.ordem ?? '-'}
                  </TableCell>
                  <TableCell className="text-center">
                    {r.ativa ? (
                      <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30">
                        Ativa
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-slate-400 border-slate-300">
                        Inativa
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedRota(r)
                        setModalOpen(true)
                      }}
                      className="h-8 w-8 text-slate-500 hover:text-slate-800"
                      title="Editar"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(r)}
                      className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <RotaModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        rota={selectedRota}
        defaultOrdem={nextOrdem}
        onSuccess={loadData}
      />
    </div>
  )
}
