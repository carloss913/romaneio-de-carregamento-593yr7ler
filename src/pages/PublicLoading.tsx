import { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import {
  Truck,
  CheckCircle2,
  Lock,
  MessageCircle,
  Save,
  X,
  RefreshCw,
  Check,
  Bell,
} from 'lucide-react'
import { Romaneio, RomaneioItem, getSecaoOrder } from '@/types/database'
import { getRomaneio, updateRomaneio } from '@/services/romaneios'
import {
  getRomaneioItens,
  updateRomaneioItem,
  refreshRomaneioItens,
} from '@/services/romaneio_itens'
import { getConfiguracoes } from '@/services/configuracoes'
import {
  formatBoxesAndPieces,
  formatProductAmount,
  formatWeight,
  isUnidadeProduto,
} from '@/lib/conversion'
import { buildWhatsAppMessage } from '@/lib/whatsapp-message'
import { RouteBadge } from '@/components/RouteBadge'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'

const SECAO_LABELS: Record<string, string> = {
  CONGELADO: 'Congelado',
  GERAL: 'Geral',
  RESFRIADO: 'Resfriado',
}

export default function PublicLoading() {
  const { id } = useParams<{ id: string }>()
  const { toast } = useToast()

  const [romaneio, setRomaneio] = useState<Romaneio | null>(null)
  const [itens, setItens] = useState<RomaneioItem[]>([])
  const [configPhone, setConfigPhone] = useState('')
  const [editingObs, setEditingObs] = useState(false)
  const [obsText, setObsText] = useState('')
  const [loading, setLoading] = useState(true)
  const [finalizing, setFinalizing] = useState(false)
  const [conferenteModalOpen, setConferenteModalOpen] = useState(false)
  const [nomeConferente, setNomeConferente] = useState('')
  const [conferenteError, setConferenteError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const refreshingRef = useRef(false)
  const pendingChangesRef = useRef<Map<string, boolean>>(new Map())
  const [editingItemObs, setEditingItemObs] = useState<{ id: string; text: string } | null>(null)

  const loadData = async () => {
    if (!id) return
    try {
      const [rom, listItens, config] = await Promise.all([
        getRomaneio(id),
        getRomaneioItens(id),
        getConfiguracoes().catch(() => null),
      ])
      setRomaneio(rom)
      setObsText(rom.observacoes || '')
      setItens(listItens)
      setConfigPhone(config?.telefone_contato || config?.telefone_whatsapp || '')
    } catch (err: any) {
      if (err?.status === 404 || err?.response?.code === 404 || err?.message?.includes('404')) {
        setRomaneio(null)
        setItens([])
      }
    }
    setLoading(false)
  }

  const handleRefresh = async (showToast = true) => {
    if (refreshingRef.current || !romaneio) return
    refreshingRef.current = true
    setRefreshing(true)
    try {
      // 1. Enviar alterações pendentes acumuladas offline
      let pendingSyncedCount = 0
      if (pendingChangesRef.current.size > 0) {
        const pendingEntries = Array.from(pendingChangesRef.current.entries())
        for (const [itemId, carregadoState] of pendingEntries) {
          try {
            await updateRomaneioItem(itemId, { carregado: carregadoState })
            pendingChangesRef.current.delete(itemId)
            pendingSyncedCount++
          } catch {
            // Mantém na fila para a próxima tentativa se falhar
          }
        }
        if (pendingSyncedCount > 0) {
          toast({
            title: `${pendingSyncedCount} alteraç${pendingSyncedCount > 1 ? 'ões pendentes sincronizadas' : 'ão pendente sincronizada'}.`,
          })
        }
      }

      // 2. Atualizar itens e recarregar dados do servidor usando dados expandidos dos itens
      const freshItens = await getRomaneioItens(romaneio.id)
      const updatedCount = await refreshRomaneioItens(freshItens)
      await loadData()
      if (showToast) {
        if (updatedCount > 0) {
          toast({
            title: `${updatedCount} item(ns) atualizado(s).`,
          })
        } else if (pendingSyncedCount === 0) {
          toast({
            title: 'Romaneio sincronizado com sucesso.',
          })
        }
      }
    } catch {
      if (showToast) toast({ title: 'Erro ao atualizar romaneio', variant: 'destructive' })
    } finally {
      refreshingRef.current = false
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Carregando romaneio...</p>
        </div>
      </div>
    )
  }

  if (!romaneio) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Truck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Romaneio não encontrado.</p>
        </div>
      </div>
    )
  }

  const isFinalizado = romaneio.status === 'finalizado'

  const sortedItens = [...itens].sort((a, b) => {
    const sa = getSecaoOrder(a.expand?.produto?.secao)
    const sb = getSecaoOrder(b.expand?.produto?.secao)
    if (sa !== sb) return sa - sb

    const descA = a.expand?.produto?.nome || ''
    const descB = b.expand?.produto?.nome || ''
    const cmp = descA.localeCompare(descB, 'pt-BR', { sensitivity: 'base' })
    if (cmp !== 0) return cmp

    return a.id.localeCompare(b.id)
  })

  const carregadoCount = itens.filter((i) => i.carregado).length

  const editingItem = editingItemObs ? itens.find((i) => i.id === editingItemObs.id) : null

  const getItemQuantidade = (item: RomaneioItem): string => {
    const prod = item.expand?.produto
    const isPct = prod?.unidade_medida === 'pacote'
    const isUn = isUnidadeProduto(prod?.unidade_medida)

    if (isPct) {
      if (!prod?.pecas_por_caixa || prod.pecas_por_caixa <= 0) {
        return `${formatWeight(item.peso_total_kg)} un`
      }
      return formatBoxesAndPieces(item.caixas, item.pecas, 'pacote')
    }

    if (isUn) {
      if (!prod?.pecas_por_caixa || prod.pecas_por_caixa <= 0) {
        return `${formatWeight(item.peso_total_kg)} un`
      }
      return formatBoxesAndPieces(item.caixas, item.pecas, 'unidade')
    }

    if (!prod?.peso_caixa_kg || prod.peso_caixa_kg <= 0) {
      return `${formatWeight(item.peso_total_kg)} kg`
    }
    return formatBoxesAndPieces(item.caixas, item.pecas, 'kg')
  }

  const getItemCodigoMarca = (item: RomaneioItem): string => {
    const codigo = item.expand?.produto?.codigo
    const marca = item.expand?.produto?.marca
    if (codigo && marca) return `${codigo} | ${marca}`
    if (codigo) return codigo
    if (marca) return marca
    return ''
  }

  const handleToggleCarregado = async (item: RomaneioItem) => {
    const nextCarregado = !item.carregado
    setItens((prev) => prev.map((i) => (i.id === item.id ? { ...i, carregado: nextCarregado } : i)))
    try {
      await updateRomaneioItem(item.id, { carregado: nextCarregado })
      // Se foi enviado com sucesso, garante que é removido da fila pendente se antes estava lá
      pendingChangesRef.current.delete(item.id)
    } catch {
      pendingChangesRef.current.set(item.id, nextCarregado)
      toast({
        title: 'Sem conexão',
        description: 'Clique em Atualizar quando estiver online para sincronizar.',
        variant: 'destructive',
      })
    }
  }

  const handleSaveObs = async () => {
    try {
      await updateRomaneio(romaneio.id, { observacoes: obsText })
      setEditingObs(false)
      toast({ title: 'Observações salvas!' })
      loadData()
    } catch {
      toast({ title: 'Erro ao salvar observações', variant: 'destructive' })
    }
  }

  const handleSaveItemObs = async () => {
    if (!editingItemObs) return
    try {
      await updateRomaneioItem(editingItemObs.id, { observacao: editingItemObs.text })
      setItens((prev) =>
        prev.map((i) =>
          i.id === editingItemObs.id ? { ...i, observacao: editingItemObs.text } : i,
        ),
      )
      setEditingItemObs(null)
      toast({ title: 'Observação do item salva!' })
    } catch {
      toast({ title: 'Erro ao salvar observação', variant: 'destructive' })
    }
  }

  const sendWhatsAppConclusion = (forceStatus?: string, conferenteNome?: string) => {
    const phone = configPhone.replace(/\D/g, '')
    if (!phone) {
      toast({
        title: 'Telefone não cadastrado',
        description: 'Não há contato registrado para envio.',
        variant: 'destructive',
      })
      return
    }
    const statusText =
      forceStatus === 'finalizado' ? 'Finalizado' : isFinalizado ? 'Finalizado' : 'Em Andamento'
    const msg = buildWhatsAppMessage(romaneio, itens, {
      statusText,
      carregadoCount,
      conferente:
        conferenteNome !== undefined ? conferenteNome : romaneio?.conferente || nomeConferente,
    })
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const handleOpenFinalizeModal = () => {
    setConferenteError('')
    setConferenteModalOpen(true)
  }

  const handleConfirmFinalize = async () => {
    const trimmed = nomeConferente.trim()
    if (!trimmed) {
      setConferenteError('O nome do conferente é obrigatório.')
      return
    }
    setFinalizing(true)
    try {
      await updateRomaneio(romaneio.id, { status: 'finalizado', conferente: trimmed })
      setRomaneio((prev) => (prev ? { ...prev, status: 'finalizado', conferente: trimmed } : prev))
      pendingChangesRef.current.clear()
      toast({ title: 'Carregamento finalizado!' })
      setConferenteModalOpen(false)
      loadData()
      sendWhatsAppConclusion('finalizado', trimmed)
    } catch {
      toast({ title: 'Erro ao finalizar', variant: 'destructive' })
    } finally {
      setFinalizing(false)
    }
  }

  const sectionGroups = sortedItens.reduce(
    (acc, item) => {
      const secao = item.expand?.produto?.secao || 'OUTROS'
      if (!acc[secao]) acc[secao] = []
      acc[secao].push(item)
      return acc
    },
    {} as Record<string, RomaneioItem[]>,
  )

  const sectionOrder = ['CONGELADO', 'GERAL', 'RESFRIADO', 'OUTROS']

  if (isFinalizado) {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="bg-slate-900 text-white sticky top-0 z-30">
          <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-base font-black tracking-tight leading-tight">
                  Romaneio #{romaneio.id.slice(-4).toUpperCase()}
                </h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <RouteBadge rota={romaneio.rota} />
                  <Badge className="bg-emerald-500 text-white text-[10px]">Finalizado</Badge>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-400 font-medium">Aberto em</p>
              <p className="text-xs font-bold whitespace-nowrap">
                {new Date(romaneio.created).toLocaleString('pt-BR')}
              </p>
            </div>
          </div>
        </header>

        <main className="max-w-3xl mx-auto p-4 md:p-6 space-y-5">
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-center gap-3">
            <Lock className="w-6 h-6 text-emerald-600 shrink-0" />
            <div>
              <h2 className="font-bold text-emerald-800">Carregamento Finalizado</h2>
              <p className="text-sm text-emerald-700">
                Este romaneio foi finalizado. O link foi inativado e os itens estão bloqueados para
                alterações.
              </p>
              {romaneio.conferente && (
                <p className="text-sm text-emerald-800 font-semibold mt-1">
                  Conferente responsável: {romaneio.conferente}
                </p>
              )}
            </div>
          </div>

          {sectionOrder.map((secao) => {
            const sectionItems = sectionGroups[secao]
            if (!sectionItems || sectionItems.length === 0) return null
            return (
              <div
                key={secao}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden"
              >
                <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                    {SECAO_LABELS[secao] || secao}
                  </h3>
                </div>
                <div className="divide-y divide-slate-100">
                  {sectionItems.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-center gap-4 px-5 py-3.5 ${
                        item.carregado ? 'bg-emerald-50/50' : ''
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${
                          item.carregado
                            ? 'bg-emerald-500 border-emerald-500 text-white'
                            : 'border-slate-300'
                        }`}
                      >
                        {item.carregado && <Check className="w-3.5 h-3.5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={`font-semibold text-slate-800 text-sm ${
                            item.carregado ? 'line-through text-slate-400' : ''
                          }`}
                        >
                          {item.expand?.produto?.nome || 'Produto'}
                          {item.obs_acrescimo && item.obs_acrescimo.trim() ? ' *' : ''}
                        </p>
                        {item.observacao && item.observacao.trim() ? (
                          <div className="text-xs text-amber-700 font-normal mt-0.5 leading-tight">
                            <strong className="font-semibold">Obs:</strong> {item.observacao.trim()}
                          </div>
                        ) : null}
                        {getItemCodigoMarca(item) && (
                          <p className="text-xs text-slate-400 mt-0.5">
                            {getItemCodigoMarca(item)}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-black text-slate-900 text-sm tabular-nums">
                          {getItemQuantidade(item)}
                        </p>
                        <p className="text-[11px] text-slate-500 tabular-nums">
                          {formatProductAmount(
                            item.peso_total_kg,
                            item.expand?.produto?.unidade_medida,
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          {itens.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-12 text-center text-slate-400">
              Nenhum item neste romaneio.
            </div>
          )}

          {romaneio.observacoes && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
              <h2 className="text-base font-bold text-slate-800 mb-2">Observações</h2>
              <p className="text-sm text-slate-600 whitespace-pre-wrap">{romaneio.observacoes}</p>
            </div>
          )}

          <Button
            onClick={() => sendWhatsAppConclusion('finalizado')}
            variant="outline"
            className="w-full rounded-xl h-12 font-bold text-green-600 border-green-500 hover:bg-green-50"
          >
            <MessageCircle className="w-5 h-5 mr-2" />
            Enviar via WhatsApp
          </Button>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-900 text-white sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/30">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-base font-black tracking-tight leading-tight">
                Romaneio #{romaneio.id.slice(-4).toUpperCase()}
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <RouteBadge rota={romaneio.rota} />
                {isFinalizado ? (
                  <Badge className="bg-emerald-500 text-white text-[10px]">Finalizado</Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="text-amber-400 border-amber-400 bg-amber-400/10 text-[10px]"
                  >
                    Em Andamento
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-slate-400 font-medium">Aberto em</p>
            <p className="text-xs font-bold whitespace-nowrap">
              {new Date(romaneio.created).toLocaleString('pt-BR')}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 md:p-6 space-y-5">
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-slate-800">Progresso do Carregamento</h2>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRefresh()}
                disabled={refreshing}
                className="h-8 text-xs text-blue-600 border-blue-400 hover:bg-blue-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
              <span className="text-sm font-bold text-slate-600 tabular-nums">
                {carregadoCount}/{itens.length}
              </span>
            </div>
          </div>
          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{
                width: `${itens.length > 0 ? (carregadoCount / itens.length) * 100 : 0}%`,
              }}
            />
          </div>
        </div>

        {sectionOrder.map((secao) => {
          const sectionItems = sectionGroups[secao]
          if (!sectionItems || sectionItems.length === 0) return null
          return (
            <div
              key={secao}
              className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden"
            >
              <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                  {SECAO_LABELS[secao] || secao}
                </h3>
              </div>
              <div className="divide-y divide-slate-100">
                {sectionItems.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-4 px-5 py-3.5 transition-all ${
                      item.carregado ? 'bg-emerald-50/50' : ''
                    }`}
                  >
                    <Checkbox
                      checked={item.carregado}
                      onCheckedChange={() => handleToggleCarregado(item)}
                      className={
                        item.carregado ? 'border-emerald-500 bg-emerald-500 text-white' : ''
                      }
                    />
                    <div className="flex-1 min-w-0">
                      <p
                        className={`font-semibold text-slate-800 text-sm ${
                          item.carregado ? 'line-through text-slate-400' : ''
                        }`}
                      >
                        {item.expand?.produto?.nome || 'Produto'}
                        {item.obs_acrescimo && item.obs_acrescimo.trim() ? ' *' : ''}
                      </p>
                      {item.observacao && item.observacao.trim() ? (
                        <div className="text-xs text-amber-700 font-normal mt-0.5 leading-tight">
                          <strong className="font-semibold">Obs:</strong> {item.observacao.trim()}
                        </div>
                      ) : null}
                      {getItemCodigoMarca(item) && (
                        <p className="text-xs text-slate-400 mt-0.5">{getItemCodigoMarca(item)}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-black text-slate-900 text-sm tabular-nums">
                        {getItemQuantidade(item)}
                      </p>
                      <p className="text-[11px] text-slate-500 tabular-nums">
                        {formatProductAmount(
                          item.peso_total_kg,
                          item.expand?.produto?.unidade_medida,
                        )}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setEditingItemObs({ id: item.id, text: item.observacao || '' })
                      }
                      className={`h-11 w-11 shrink-0 rounded-full ${
                        item.observacao && item.observacao.trim().length > 0
                          ? 'text-amber-500 hover:bg-amber-50'
                          : 'text-slate-400 hover:bg-slate-100'
                      }`}
                      title={
                        item.observacao && item.observacao.trim().length > 0
                          ? 'Editar observação do item'
                          : 'Adicionar observação ao item'
                      }
                    >
                      <Bell
                        className={`w-5 h-5 ${
                          item.observacao && item.observacao.trim().length > 0
                            ? 'fill-amber-400'
                            : ''
                        }`}
                      />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )
        })}

        {itens.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-12 text-center text-slate-400">
            Nenhum item neste romaneio.
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-base font-bold text-slate-800">Observações</h2>
            {!editingObs ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setObsText(romaneio.observacoes || '')
                  setEditingObs(true)
                }}
                className="text-slate-500 hover:text-slate-800"
              >
                Editar
              </Button>
            ) : (
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSaveObs}
                  className="text-emerald-600"
                >
                  <Save className="w-3.5 h-3.5 mr-1" /> Salvar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingObs(false)}
                  className="text-slate-400"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
          </div>
          {editingObs ? (
            <Textarea
              value={obsText}
              onChange={(e) => setObsText(e.target.value)}
              placeholder="Instruções do motorista, observações de temperatura, avarias..."
              rows={3}
            />
          ) : (
            <p
              className={`text-sm ${romaneio.observacoes ? 'text-slate-600' : 'text-slate-300 italic'}`}
            >
              {romaneio.observacoes || 'Nenhuma observação registrada.'}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          {!isFinalizado ? (
            <Button
              onClick={handleOpenFinalizeModal}
              disabled={finalizing}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl h-12"
            >
              <CheckCircle2 className="w-5 h-5 mr-2" />
              {finalizing ? 'Finalizando...' : 'Finalizar Carregamento'}
            </Button>
          ) : (
            <div className="flex-1 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-semibold text-emerald-700">
                Carregamento finalizado
              </span>
            </div>
          )}
          <Button
            onClick={() => sendWhatsAppConclusion()}
            variant="outline"
            className="flex-1 rounded-xl h-12 font-bold text-green-600 border-green-500 hover:bg-green-50"
          >
            <MessageCircle className="w-5 h-5 mr-2" />
            Enviar via WhatsApp
          </Button>
        </div>
      </main>

      {/* Modal Nome do Conferente */}
      <Dialog
        open={conferenteModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setConferenteModalOpen(false)
            setConferenteError('')
          }
        }}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Finalizar Carregamento
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-slate-600">
              Informe o <strong>nome do conferente</strong> responsável pela carga para concluir e
              gerar o relatório no WhatsApp:
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="nomeConferenteInput">
                Nome do Conferente <span className="text-red-500">*</span>
              </Label>
              <Input
                id="nomeConferenteInput"
                value={nomeConferente}
                onChange={(e) => {
                  setNomeConferente(e.target.value)
                  if (e.target.value.trim()) setConferenteError('')
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleConfirmFinalize()
                  }
                }}
                placeholder="Ex: João Silva"
                autoFocus
                className={conferenteError ? 'border-red-500' : ''}
              />
              {conferenteError && (
                <p className="text-xs text-red-600 font-medium">{conferenteError}</p>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setConferenteModalOpen(false)
                setConferenteError('')
              }}
              disabled={finalizing}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirmFinalize}
              disabled={finalizing || !nomeConferente.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {finalizing ? 'Finalizando...' : 'Confirmar e Finalizar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingItemObs} onOpenChange={(v) => !v && setEditingItemObs(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-500" />
              Observação do Item
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {editingItem && (
              <div className="text-sm">
                <p className="font-semibold text-slate-800">
                  {editingItem.expand?.produto?.nome || 'Produto'}
                  {editingItem.obs_acrescimo && editingItem.obs_acrescimo.trim() ? ' *' : ''}
                </p>
                {getItemCodigoMarca(editingItem) && (
                  <p className="text-xs text-slate-400">{getItemCodigoMarca(editingItem)}</p>
                )}
              </div>
            )}
            <Textarea
              value={editingItemObs?.text || ''}
              onChange={(e) =>
                setEditingItemObs((prev) => (prev ? { ...prev, text: e.target.value } : null))
              }
              placeholder="Digite uma observação para este item..."
              rows={4}
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditingItemObs(null)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSaveItemObs}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              <Save className="w-4 h-4 mr-1" /> Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
