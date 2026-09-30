import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Plus,
  FileText,
  CheckCircle2,
  Clock,
  Trash2,
  Calendar,
  X,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react'
import { RotaType, Romaneio, RomaneioItem } from '@/types/database'
import { formatWeight } from '@/lib/conversion'
import { getRomaneiosByRota, deleteRomaneio } from '@/services/romaneios'
import { deleteItensByRomaneio } from '@/services/romaneio_itens'
import { runAutoDelete } from '@/services/autoDelete'
import pb from '@/lib/pocketbase/client'
import { RouteBadge } from '@/components/RouteBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NovoRomaneioModal } from '@/components/NovoRomaneioModal'
import { useRealtime } from '@/hooks/use-realtime'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

const INITIAL_LIMIT = 6

export default function RotaDetail() {
  const { rota } = useParams<{ rota: string }>()
  const rotaDecoded = decodeURIComponent(rota || '') as RotaType

  const [romaneios, setRomaneios] = useState<Romaneio[]>([])
  const [itens, setItens] = useState<RomaneioItem[]>([])
  const [totalRomaneiosCount, setTotalRomaneiosCount] = useState<number>(0)
  const [isExpanded, setIsExpanded] = useState<boolean>(false)
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false)
  const [allLoaded, setAllLoaded] = useState<boolean>(false)

  // Filtros de data
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')

  const [novoModalOpen, setNovoModalOpen] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id?: string }>({ open: false })
  const [isDeleting, setIsDeleting] = useState(false)

  const realtimeDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isExpandedRef = useRef<boolean>(isExpanded)
  isExpandedRef.current = isExpanded

  const startDateRef = useRef<string>(startDate)
  startDateRef.current = startDate
  const endDateRef = useRef<string>(endDate)
  endDateRef.current = endDate

  // Helper para buscar itens dos romaneios sem duplicar
  const fetchItensForRomaneios = useCallback(
    async (romaneioList: Romaneio[], currentItens: RomaneioItem[] = []) => {
      if (romaneioList.length === 0) return []
      const existingRomaneioIds = new Set(currentItens.map((i) => i.romaneio))
      const missingRomaneios = romaneioList.filter((r) => !existingRomaneioIds.has(r.id))

      if (missingRomaneios.length === 0) {
        return currentItens
      }

      // Busca itens em lotes se necessário (máximo de 50 romaneios por query)
      const batchSize = 30
      let newlyFetchedItens: RomaneioItem[] = []
      for (let i = 0; i < missingRomaneios.length; i += batchSize) {
        const batch = missingRomaneios.slice(i, i + batchSize)
        const filter = batch.map((r) => `romaneio = "${r.id}"`).join(' || ')
        try {
          const batchItens = await pb.collection('romaneio_itens').getFullList<RomaneioItem>({
            filter,
            fields: 'id,romaneio,peso_total_kg,caixas,pecas',
          })
          newlyFetchedItens = [...newlyFetchedItens, ...batchItens]
        } catch (errItens: any) {
          if (
            errItens?.status !== 404 &&
            errItens?.response?.code !== 404 &&
            !errItens?.message?.includes('404')
          ) {
            console.error('Erro ao buscar itens dos romaneios:', errItens)
          }
        }
      }

      const currentRomaneioIds = new Set(romaneioList.map((r) => r.id))
      const filteredCurrent = currentItens.filter((i) => currentRomaneioIds.has(i.romaneio))
      return [...filteredCurrent, ...newlyFetchedItens]
    },
    [],
  )

  // Constrói filtro do PocketBase para data
  const buildDatePbFilter = useCallback((sDate: string, eDate: string) => {
    const filters: string[] = []
    if (sDate && eDate) {
      const [start, end] = sDate <= eDate ? [sDate, eDate] : [eDate, sDate]
      filters.push(`data >= "${start} 00:00:00.000Z" && data <= "${end} 23:59:59.999Z"`)
    } else if (sDate) {
      filters.push(`data >= "${sDate} 00:00:00.000Z" && data <= "${sDate} 23:59:59.999Z"`)
    } else if (eDate) {
      filters.push(`data >= "${eDate} 00:00:00.000Z" && data <= "${eDate} 23:59:59.999Z"`)
    }
    return filters.length > 0 ? filters.join(' && ') : undefined
  }, [])

  const isFilterActive = Boolean(startDate || endDate)

  const loadData = useCallback(async () => {
    try {
      const activeStartDate = startDateRef.current
      const activeEndDate = endDateRef.current
      const dateFilterStr = buildDatePbFilter(activeStartDate, activeEndDate)

      if (dateFilterStr) {
        // Quando há filtro de data ativo, busca todos os correspondentes ao filtro
        const list = await pb.collection('romaneios').getFullList<Romaneio>({
          filter: `rota = "${rotaDecoded}" && (${dateFilterStr})`,
          sort: '-data,-created',
        })

        setRomaneios(list)
        setTotalRomaneiosCount(list.length)
        setAllLoaded(true)

        setItens((prev) => {
          fetchItensForRomaneios(list, prev).then((updated) => setItens(updated))
          return prev
        })
        return
      }

      // Sem filtro de data
      if (isExpandedRef.current) {
        // Se já estava expandido, carrega a lista completa
        const fullList = await pb.collection('romaneios').getFullList<Romaneio>({
          filter: `rota = "${rotaDecoded}"`,
          sort: '-data,-created',
        })
        setRomaneios(fullList)
        setTotalRomaneiosCount(fullList.length)
        setAllLoaded(true)

        setItens((prev) => {
          fetchItensForRomaneios(fullList, prev).then((updated) => setItens(updated))
          return prev
        })
      } else {
        // Modo padrão otimizado: busca página inicial com 6 romaneios e obtém total de itens
        const paged = await pb.collection('romaneios').getList<Romaneio>(1, INITIAL_LIMIT, {
          filter: `rota = "${rotaDecoded}"`,
          sort: '-data,-created',
        })

        setRomaneios(paged.items)
        setTotalRomaneiosCount(paged.totalItems)
        setAllLoaded(paged.totalItems <= paged.items.length)

        setItens((prev) => {
          fetchItensForRomaneios(paged.items, prev).then((updated) => setItens(updated))
          return prev
        })
      }
    } catch (err: any) {
      if (err?.status === 404 || err?.response?.code === 404 || err?.message?.includes('404')) {
        setRomaneios([])
        setItens([])
        setTotalRomaneiosCount(0)
        return
      }
      console.error('Erro ao carregar dados:', err)
      toast.error('Erro ao carregar dados')
    }
  }, [rotaDecoded, buildDatePbFilter, fetchItensForRomaneios])

  const debouncedLoadData = useCallback(() => {
    if (realtimeDebounceTimerRef.current) {
      clearTimeout(realtimeDebounceTimerRef.current)
    }
    realtimeDebounceTimerRef.current = setTimeout(() => {
      loadData()
    }, 500)
  }, [loadData])

  useEffect(() => {
    return () => {
      if (realtimeDebounceTimerRef.current) {
        clearTimeout(realtimeDebounceTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    // Dispara a rotina de exclusão automática (fire-and-forget) e
    // recarrega a lista caso algo tenha sido removido.
    runAutoDelete()
      .then((excluidos) => {
        if (excluidos > 0) loadData()
      })
      .catch((err) => {
        console.error('Erro na exclusão automática:', err)
      })
    loadData()
  }, [loadData, startDate, endDate])

  // Pausa realtime durante exclusão em massa para não saturar requisições nem disputar rate limit
  useRealtime('romaneios', debouncedLoadData, !isDeleting)
  useRealtime('romaneio_itens', debouncedLoadData, !isDeleting)

  const handleDelete = async () => {
    const idToDelete = deleteDialog.id
    if (!idToDelete || isDeleting) return
    setIsDeleting(true)
    try {
      // Exclui itens associados com concorrência suave e retries persistentes
      const result = await deleteItensByRomaneio(idToDelete)

      // Se algum item falhou de forma definitiva, NÃO apaga o romaneio pai
      if (result.failedItens.length > 0) {
        toast.error(
          `Não foi possível excluir ${result.failedItens.length} de ${result.total} item(ns). O romaneio não foi apagado para preservar os dados.`,
        )
        return
      }

      await deleteRomaneio(idToDelete)
      toast.success('Romaneio excluído com sucesso')
      setDeleteDialog({ open: false, id: undefined })
    } catch (err: any) {
      console.error('Erro ao excluir romaneio:', err)
      toast.error('Erro ao excluir romaneio')
    } finally {
      setIsDeleting(false)
      // Atualiza a lista UMA ÚNICA VEZ no final, independentemente de sucesso ou falha
      try {
        await loadData()
      } catch {
        /* ignore */
      }
    }
  }

  const handleToggleExpand = async () => {
    if (isExpanded) {
      // Recolhe para 6
      setIsExpanded(false)
      isExpandedRef.current = false
      return
    }

    // Se vai expandir e ainda não carregou todos do histórico
    if (!allLoaded && romaneios.length < totalRomaneiosCount) {
      setIsLoadingMore(true)
      try {
        const fullList = await pb.collection('romaneios').getFullList<Romaneio>({
          filter: `rota = "${rotaDecoded}"`,
          sort: '-data,-created',
        })
        setRomaneios(fullList)
        setTotalRomaneiosCount(fullList.length)
        setAllLoaded(true)
        setIsExpanded(true)
        isExpandedRef.current = true

        const updatedItens = await fetchItensForRomaneios(fullList, itens)
        setItens(updatedItens)
      } catch (err) {
        console.error('Erro ao expandir romaneios:', err)
        toast.error('Erro ao carregar histórico completo')
      } finally {
        setIsLoadingMore(false)
      }
    } else {
      setIsExpanded(true)
      isExpandedRef.current = true
    }
  }

  const handleClearFilter = () => {
    setStartDate('')
    setEndDate('')
  }

  // Lista a ser renderizada:
  // Se filtro ativo: mostra todos que bateram no filtro
  // Se sem filtro: se expandido mostra todos carregados, se recolhido mostra no máximo os 6 primeiros
  const displayedRomaneios = isFilterActive
    ? romaneios
    : isExpanded
      ? romaneios
      : romaneios.slice(0, INITIAL_LIMIT)

  // Há mais itens para expandir se sem filtro e (não expandido) e (total > 6 ou romaneios.length > 6)
  const canExpandOrCollapse =
    !isFilterActive && (totalRomaneiosCount > INITIAL_LIMIT || romaneios.length > INITIAL_LIMIT)

  const totalKg = itens
    .filter((i) => displayedRomaneios.some((r) => r.id === i.romaneio))
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
              {isFilterActive
                ? `${displayedRomaneios.length} romaneio(s) encontrado(s) • ${formatWeight(totalKg)} kg`
                : `${totalRomaneiosCount} romaneios cadastrados • exibindo ${displayedRomaneios.length} • ${formatWeight(totalKg)} kg`}
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

      {/* Date Filter Card */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-slate-700 font-bold text-sm">
            <Calendar className="w-4 h-4 text-orange-500" />
            <span>Filtrar romaneios por data</span>
            {isFilterActive && (
              <span className="text-[11px] font-semibold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                Ativo
              </span>
            )}
          </div>

          {isFilterActive && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClearFilter}
              className="text-xs text-slate-500 hover:text-red-600 hover:bg-red-50 h-8 px-2 self-start sm:self-auto"
            >
              <X className="w-3.5 h-3.5 mr-1" />
              Limpar filtro
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3 pt-3 border-t border-slate-100 items-end">
          <div className="space-y-1">
            <label htmlFor="filter-start-date" className="text-xs font-semibold text-slate-600">
              Data inicial
            </label>
            <div className="relative">
              <Input
                id="filter-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-slate-50/50 rounded-xl text-xs h-9"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="filter-end-date" className="text-xs font-semibold text-slate-600">
              Data final (opcional)
            </label>
            <div className="relative">
              <Input
                id="filter-end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-slate-50/50 rounded-xl text-xs h-9"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const today = new Date().toISOString().split('T')[0]
                setStartDate(today)
                setEndDate(today)
              }}
              className="text-xs h-9 rounded-xl flex-1 font-medium text-slate-600 hover:text-slate-900 border-slate-200"
            >
              Hoje
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const d = new Date()
                d.setDate(d.getDate() - 7)
                setStartDate(d.toISOString().split('T')[0])
                setEndDate(new Date().toISOString().split('T')[0])
              }}
              className="text-xs h-9 rounded-xl flex-1 font-medium text-slate-600 hover:text-slate-900 border-slate-200"
            >
              Últimos 7 dias
            </Button>
          </div>
        </div>
      </div>

      {/* Romaneios List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            {isFilterActive
              ? `Romaneios filtrados (${displayedRomaneios.length})`
              : `Romaneios da Rota (${displayedRomaneios.length} de ${totalRomaneiosCount})`}
          </h2>
          {!isFilterActive && totalRomaneiosCount > INITIAL_LIMIT && (
            <span className="text-xs text-slate-400">
              {isExpanded ? 'Histórico completo' : `Exibindo 6 mais recentes`}
            </span>
          )}
        </div>

        {displayedRomaneios.length === 0 ? (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-12 text-center space-y-3">
            <FileText className="w-12 h-12 text-slate-300 mx-auto" />
            <p className="text-base font-bold text-slate-700">
              {isFilterActive
                ? 'Nenhum romaneio encontrado no período selecionado'
                : `Nenhum romaneio para a rota ${rotaDecoded}`}
            </p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {isFilterActive
                ? 'Tente ajustar as datas do filtro ou clique em "Limpar filtro" para ver os romaneios da rota.'
                : 'Inicie a montagem da carga abrindo o primeiro romaneio desta rota.'}
            </p>
            {isFilterActive ? (
              <Button
                type="button"
                variant="outline"
                onClick={handleClearFilter}
                className="mt-2 text-xs font-semibold rounded-xl"
              >
                Limpar filtro
              </Button>
            ) : (
              <Button
                onClick={() => setNovoModalOpen(true)}
                className="bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl mt-2"
              >
                Criar Primeiro Romaneio
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {displayedRomaneios.map((rom) => {
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
                          {formatWeight(pesoRom)} kg
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

            {/* Ver mais / Ver menos button when not filtered */}
            {canExpandOrCollapse && (
              <div className="flex justify-center pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleToggleExpand}
                  disabled={isLoadingMore}
                  className="rounded-xl border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 px-6 py-2 h-10 shadow-sm"
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin text-orange-500" />
                      Carregando histórico...
                    </>
                  ) : isExpanded ? (
                    <>
                      <ChevronUp className="w-4 h-4 mr-1.5 text-slate-500" />
                      Ver menos (mostrar apenas 6)
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4 mr-1.5 text-slate-500" />
                      Ver mais ({totalRomaneiosCount - displayedRomaneios.length} romaneios
                      adicionais)
                    </>
                  )}
                </Button>
              </div>
            )}
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
            <Button
              variant="outline"
              disabled={isDeleting}
              onClick={() => setDeleteDialog({ open: false, id: undefined })}
            >
              Cancelar
            </Button>
            <Button variant="destructive" disabled={isDeleting} onClick={handleDelete}>
              {isDeleting ? 'Excluindo...' : 'Excluir Agora'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
