import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, FileText, CheckCircle2, Clock, Trash2 } from 'lucide-react'
import { RotaType, ROTAS, Romaneio, RomaneioItem } from '@/types/database'
import { getRomaneiosByRota, deleteRomaneio } from '@/services/romaneios'
import pb from '@/lib/pocketbase/client'
import { RouteBadge } from '@/components/RouteBadge'
import { Button } from '@/components/ui/button'
import { NovoRomaneioModal } from '@/components/NovoRomaneioModal'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

export default function RotaDetail() {
  const { rota } = useParams<{ rota: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const rotaDecoded = decodeURIComponent(rota || '') as RotaType
  const rotaConfig = ROTAS.find((r) => r.name === rotaDecoded)

  const [romaneios, setRomaneios] = useState<Romaneio[]>([])
  const [itens, setItens] = useState<RomaneioItem[]>([])
  const [novoModalOpen, setNovoModalOpen] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id?: string }>({ open: false })

  const loadData = async () => {
    if (!rotaConfig) return
    try {
      const list = await getRomaneiosByRota(rotaDecoded)
      setRomaneios(list)
      const allItens = await pb.collection('romaneio_itens').getFullList<RomaneioItem>()
      setItens(allItens)
    } catch {
      /* intentionally ignored */
    }
  }

  useEffect(() => {
    if (!rotaConfig) {
      navigate('/')
      return
    }
    loadData()
  }, [rotaDecoded])

  useRealtime('romaneios', () => loadData())
  useRealtime('romaneio_itens', () => loadData())

  if (!rotaConfig) {
    return null
  }

  const handleDelete = async () => {
    if (!deleteDialog.id) return
    try {
      await deleteRomaneio(deleteDialog.id)
      toast({ title: 'Romaneio excluído', description: 'O carregamento foi removido.' })
      setDeleteDialog({ open: false })
      loadData()
    } catch (err) {
      toast({
        title: 'Erro ao excluir',
        description: 'Não foi possível remover o romaneio.',
        variant: 'destructive',
      })
    }
  }

  const totalKg = itens
    .filter((i) => romaneios.some((r) => r.id === i.romaneio))
    .reduce((a, b) => a + b.peso_total_kg, 0)

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-slate-800 tracking-tight">
                Rota {rotaDecoded}
              </h1>
              <RouteBadge rota={rotaDecoded} />
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {romaneios.length} romaneios cadastrados • {totalKg.toFixed(1)} kg total
            </p>
          </div>
        </div>

        <Button
          onClick={() => setNovoModalOpen(true)}
          className="bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl shadow-md shadow-orange-500/20"
        >
          <Plus className="w-4 h-4 mr-2" /> Novo Romaneio {rotaDecoded}
        </Button>
      </div>

      {/* Romaneios List */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Lista de Romaneios da Rota
        </h2>

        {romaneios.length === 0 ? (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-12 text-center space-y-3">
            <FileText className="w-12 h-12 text-slate-300 mx-auto" />
            <p className="text-base font-bold text-slate-700">
              Nenhum romaneio para a rota {rotaDecoded}
            </p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Inicie a montagem da carga abrindo o primeiro romaneio desta rota.
            </p>
            <Button
              onClick={() => setNovoModalOpen(true)}
              className="bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl mt-2"
            >
              Criar Primeiro Romaneio
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {romaneios.map((rom) => {
              const romItens = itens.filter((i) => i.romaneio === rom.id)
              const pesoRom = romItens.reduce((a, b) => a + b.peso_total_kg, 0)
              const caixasRom = romItens.reduce((a, b) => a + b.caixas, 0)
              const pecasRom = romItens.reduce((a, b) => a + b.pecas, 0)

              return (
                <div
                  key={rom.id}
                  className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-black text-slate-800">
                          Romaneio #{rom.id.slice(-4).toUpperCase()}
                        </span>
                        {rom.status === 'finalizado' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3" /> Finalizado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                            <Clock className="w-3 h-3" /> Em Andamento
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Data de Carga:{' '}
                        {new Date(rom.data).toLocaleDateString('pt-BR', {
                          timeZone: 'UTC',
                        })}
                      </p>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteDialog({ open: true, id: rom.id })}
                      className="text-slate-300 hover:text-red-500 hover:bg-red-50 h-8 w-8"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  {rom.observacoes && (
                    <p className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-xl my-3 italic line-clamp-2">
                      "{rom.observacoes}"
                    </p>
                  )}

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div className="text-xs text-slate-500 space-x-2">
                      <span className="font-bold text-slate-800 tabular-nums">
                        {pesoRom.toFixed(1)} kg
                      </span>
                      <span>•</span>
                      <span>{caixasRom} cx</span>
                      {pecasRom > 0 && <span>+ {pecasRom} pct</span>}
                    </div>

                    <Link to={`/romaneios/${rom.id}`}>
                      <Button
                        size="sm"
                        className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl"
                      >
                        Abrir Romaneio
                      </Button>
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <NovoRomaneioModal
        open={novoModalOpen}
        onOpenChange={setNovoModalOpen}
        defaultRota={rotaDecoded}
      />

      <Dialog open={deleteDialog.open} onOpenChange={(v) => setDeleteDialog({ open: v })}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>Excluir Romaneio?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-500 py-2">
            Esta ação é irreversível e excluirá todos os itens vinculados a este romaneio.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false })}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Excluir Agora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
