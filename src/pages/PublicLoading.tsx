import { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { Truck, CheckCircle2, Lock, MessageCircle, Save, X, RefreshCw } from 'lucide-react'
import { Romaneio, RomaneioItem, getSecaoOrder } from '@/types/database'
import { getRomaneio, updateRomaneio } from '@/services/romaneios'
import {
  getRomaneioItens,
  updateRomaneioItem,
  refreshRomaneioItens,
} from '@/services/romaneio_itens'
import { getProdutos } from '@/services/produtos'
import { getConfiguracoes } from '@/services/configuracoes'
import { formatBoxesAndPieces } from '@/lib/conversion'
import { buildWhatsAppMessage } from '@/lib/whatsapp-message'
import { RouteBadge } from '@/components/RouteBadge'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { useRealtime } from '@/hooks/use-realtime'
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
  const [refreshing, setRefreshing] = useState(false)
  const refreshingRef = useRef(false)

  const handleRefresh = async (showToast = true) => {
    if (refreshingRef.current || !romaneio) return
    refreshingRef.current = true
    setRefreshing(true)
    try {
      const freshProdutos = await getProdutos()
      const updatedCount = await refreshRomaneioItens(itens, freshProdutos)
      if (showToast) {
        toast({
          title:
            updatedCount > 0
              ? `${updatedCount} item(ns) atualizado(s).`
              : 'Nenhum item precisou de atualização.',
        })
      }
      if (updatedCount > 0) loadData()
    } catch {
      if (showToast) toast({ title: 'Erro ao atualizar romaneio', variant: 'destructive' })
    } finally {
      refreshingRef.current = false
      setRefreshing(false)
    }
  }

  const loadData = async () => {
    if (!id) return
    try {
      const rom = await getRomaneio(id)
      setRomaneio(rom)
      setObsText(rom.observacoes || '')
      const listItens = await getRomaneioItens(id)
      setItens(listItens)
      try {
        const config = await getConfiguracoes()
        setConfigPhone(config?.telefone_contato || config?.telefone_whatsapp || '')
      } catch {
        /* no config */
      }
    } catch {
      /* load failed */
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [id])

  useRealtime('romaneios', () => loadData())
  useRealtime('romaneio_itens', () => loadData())
  useRealtime('produtos', () => handleRefresh(false))

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

  const sortedItens = [...itens]
    .sort((a, b) => {
      const ca = new Date(a.created).getTime()
      const cb = new Date(b.created).getTime()
      if (ca !== cb) return ca - cb
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
    })
    .sort((a, b) => {
      const sa = getSecaoOrder(a.expand?.produto?.secao)
      const sb = getSecaoOrder(b.expand?.produto?.secao)
      return sa - sb
    })

  const carregadoCount = itens.filter((i) => i.carregado).length

  const getItemQuantidade = (item: RomaneioItem): string => {
    if (!item.expand?.produto?.peso_caixa_kg || item.expand?.produto?.peso_caixa_kg <= 0) {
      return `${item.peso_total_kg.toFixed(1)} kg`
    }
    return formatBoxesAndPieces(item.caixas, item.pecas)
  }

  const handleToggleCarregado = async (item: RomaneioItem) => {
    try {
      await updateRomaneioItem(item.id, { carregado: !item.carregado })
      setItens((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, carregado: !i.carregado } : i)),
      )
    } catch {
      toast({ title: 'Erro ao atualizar item', variant: 'destructive' })
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

  const sendWhatsAppConclusion = (forceStatus?: string) => {
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
    })
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const handleFinalize = async () => {
    setFinalizing(true)
    try {
      await updateRomaneio(romaneio.id, { status: 'finalizado' })
      setRomaneio((prev) => (prev ? { ...prev, status: 'finalizado' } : prev))
      toast({ title: 'Carregamento finalizado!' })
      loadData()
      sendWhatsAppConclusion('finalizado')
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
            <p className="text-[10px] text-slate-400 font-medium">Data</p>
            <p className="text-sm font-bold">
              {new Date(romaneio.data).toLocaleDateString('pt-BR')}
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
                      </p>
                      {item.expand?.produto?.marca && (
                        <p className="text-xs text-slate-400">{item.expand.produto.marca}</p>
                      )}
                    </div>
                    <p className="font-black text-slate-900 text-sm tabular-nums shrink-0">
                      {getItemQuantidade(item)}
                    </p>
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
              onClick={handleFinalize}
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
    </div>
  )
}
