import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  FileSpreadsheet,
  Plus,
  Printer,
  CheckCircle2,
  Lock,
  Unlock,
  Trash2,
  Copy,
  Check,
  Send,
  Save,
  X,
  Pencil,
  RefreshCw,
  UserCheck,
} from 'lucide-react'
import { Romaneio, RomaneioItem, Produto, getSecaoOrder, normalizeSecao } from '@/types/database'
import { getRomaneio, updateRomaneio, deleteRomaneio } from '@/services/romaneios'
import {
  getRomaneioItens,
  createRomaneioItem,
  updateRomaneioItem,
  deleteRomaneioItem,
} from '@/services/romaneio_itens'
import { getProdutos, updateProduto } from '@/services/produtos'
import { getConfiguracoes } from '@/services/configuracoes'
import { refreshRomaneioItens } from '@/services/romaneio_itens'
import {
  convertWeightToBoxesAndPieces,
  convertUnitsToBoxesAndPieces,
  formatBoxesAndPieces,
  formatProductAmount,
  formatWeight,
  isUnidadeProduto,
} from '@/lib/conversion'
import { RouteBadge } from '@/components/RouteBadge'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { ImportWizardModal } from '@/components/ImportWizardModal'
import { buildWhatsAppMessage } from '@/lib/whatsapp-message'
import { PrintManifest } from '@/components/PrintManifest'
import { ResizableTableRow } from '@/components/ResizableTableRow'
import { useRealtime } from '@/hooks/use-realtime'
import { toast } from 'sonner'

export default function RomaneioDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [romaneio, setRomaneio] = useState<Romaneio | null>(null)
  const [itens, setItens] = useState<RomaneioItem[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [configContato, setConfigContato] = useState('')

  const [importWizardOpen, setImportWizardOpen] = useState(false)
  const [manualItemModal, setManualItemModal] = useState(false)
  const [selectedProdutoId, setSelectedProdutoId] = useState('')
  const [pesoManual, setPesoManual] = useState<number | ''>('')
  const [produtoSearch, setProdutoSearch] = useState('')
  const [showSugestoes, setShowSugestoes] = useState(false)
  const produtoComboRef = useRef<HTMLDivElement>(null)

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [editingObs, setEditingObs] = useState(false)
  const [obsText, setObsText] = useState('')
  const [linkCopied, setLinkCopied] = useState(false)
  const [editingItemObs, setEditingItemObs] = useState<{ id: string; text: string } | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const refreshingRef = useRef(false)
  const [updatingSecaoProdId, setUpdatingSecaoProdId] = useState<string | null>(null)

  const initialLoadDoneRef = useRef(false)
  const realtimeDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isDeletedRef = useRef(false)

  const loadData = useCallback(async () => {
    if (!id || isDeletedRef.current) return
    try {
      const rom = await getRomaneio(id)
      setRomaneio(rom)
      setObsText(rom.observacoes || '')
      const listItens = await getRomaneioItens(id)
      setItens(listItens)
      const listProds = await getProdutos()
      setProdutos(listProds)
      try {
        const config = await getConfiguracoes()
        setConfigContato(config?.telefone_contato || '')
      } catch {
        /* no config yet */
      }
    } catch (err: any) {
      // Se retornar 404 Not Found, o romaneio foi excluído
      if (err?.status === 404 || err?.response?.code === 404 || err?.message?.includes('404')) {
        if (!isDeletedRef.current) {
          isDeletedRef.current = true
          toast.error('Este romaneio foi excluído')
          navigate('/', { replace: true })
        }
        return
      }
      toast.error('Erro ao carregar dados')
    }
  }, [id, navigate])

  const handleRefresh = useCallback(
    async (showToast = true) => {
      if (refreshingRef.current || !id) return
      refreshingRef.current = true
      setRefreshing(true)
      try {
        const freshProdutos = await getProdutos()
        setProdutos(freshProdutos)
        const currentItens = await getRomaneioItens(id)
        const updatedCount = await refreshRomaneioItens(currentItens, freshProdutos)
        if (showToast) {
          toast.success(
            updatedCount > 0
              ? `${updatedCount} item(ns) atualizado(s) com os dados mais recentes.`
              : 'Nenhum item precisou de atualização.',
          )
        }
        if (updatedCount > 0) loadData()
      } catch {
        if (showToast) toast.error('Erro ao atualizar romaneio')
      } finally {
        refreshingRef.current = false
        setRefreshing(false)
      }
    },
    [id, loadData],
  )

  const debouncedLoadData = useCallback(() => {
    if (!initialLoadDoneRef.current || isDeletedRef.current) return
    if (realtimeDebounceTimerRef.current) {
      clearTimeout(realtimeDebounceTimerRef.current)
    }
    realtimeDebounceTimerRef.current = setTimeout(() => {
      if (!isDeletedRef.current) {
        loadData()
      }
    }, 500)
  }, [loadData])

  const debouncedHandleRefresh = useCallback(() => {
    if (!initialLoadDoneRef.current || isDeletedRef.current) return
    // If the local user is currently updating a section in background, skip refreshing to avoid jumping scroll/full reload
    if (updatingSecaoProdId) return
    if (realtimeDebounceTimerRef.current) {
      clearTimeout(realtimeDebounceTimerRef.current)
    }
    realtimeDebounceTimerRef.current = setTimeout(() => {
      if (!isDeletedRef.current) {
        handleRefresh(false)
      }
    }, 500)
  }, [handleRefresh, updatingSecaoProdId])

  useEffect(() => {
    return () => {
      if (realtimeDebounceTimerRef.current) {
        clearTimeout(realtimeDebounceTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    loadData().then(() => {
      initialLoadDoneRef.current = true
    })
  }, [loadData])

  useRealtime('romaneios', debouncedLoadData)
  useRealtime('romaneio_itens', debouncedLoadData)
  useRealtime('produtos', debouncedHandleRefresh)

  useEffect(() => {
    if (!showSugestoes) return
    const handler = (e: MouseEvent) => {
      if (produtoComboRef.current && !produtoComboRef.current.contains(e.target as Node)) {
        setShowSugestoes(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showSugestoes])

  if (!romaneio) return null

  const isFinalizado = romaneio.status === 'finalizado'

  const selectedProd = produtos.find((p) => p.id === selectedProdutoId) || null
  const filteredProdutos = produtos
    .filter((p) => p.ativo)
    .filter((p) => {
      const q = produtoSearch.trim().toLowerCase()
      if (!q) return true
      return (p.codigo || '').toLowerCase().includes(q)
    })
    .slice(0, 100)

  const sortedItens = [...itens].sort((a, b) => {
    const sa = getSecaoOrder(a.expand?.produto?.secao)
    const sb = getSecaoOrder(b.expand?.produto?.secao)
    if (sa !== sb) return sa - sb

    const descA = a.expand?.produto?.nome || ''
    const descB = b.expand?.produto?.nome || ''
    return descA.localeCompare(descB, 'pt-BR', { sensitivity: 'base' })
  })

  const totalPeso = itens
    .filter((i) => !isUnidadeProduto(i.expand?.produto?.unidade_medida))
    .reduce((a, b) => a + b.peso_total_kg, 0)
  const totalUnidades = itens
    .filter((i) => isUnidadeProduto(i.expand?.produto?.unidade_medida))
    .reduce((a, b) => a + b.peso_total_kg, 0)
  const totalCaixas = itens.reduce((a, b) => a + b.caixas, 0)
  const totalPecas = itens.reduce((a, b) => a + b.pecas, 0)

  const handleToggleStatus = async () => {
    const nextStatus = isFinalizado ? 'em_andamento' : 'finalizado'
    try {
      // If reopening, we keep the conferente or can leave it as is; if finalizing manually in admin without conferente, just update status
      await updateRomaneio(romaneio.id, { status: nextStatus })
      toast.success(
        isFinalizado
          ? 'Romaneio Reaberto — Edições liberadas.'
          : 'Romaneio Finalizado — Carga bloqueada para alterações.',
      )
      loadData()
    } catch {
      toast.error('Erro ao alterar status')
    }
  }

  const handleAddManualItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProdutoId || !pesoManual || pesoManual <= 0) return
    const prod = produtos.find((p) => p.id === selectedProdutoId)
    if (!prod) return

    const conv = isUnidadeProduto(prod.unidade_medida)
      ? convertUnitsToBoxesAndPieces(Number(pesoManual), prod.pecas_por_caixa)
      : convertWeightToBoxesAndPieces(
          Number(pesoManual),
          prod.peso_caixa_kg,
          prod.peso_peca_kg,
          prod.pecas_por_caixa,
        )

    try {
      await createRomaneioItem({
        romaneio: romaneio.id,
        produto: prod.id,
        peso_total_kg: Number(pesoManual),
        caixas: conv.caixas,
        pecas: conv.pecas,
      })
      toast.success('Item adicionado!')
      setManualItemModal(false)
      setSelectedProdutoId('')
      setPesoManual('')
      setProdutoSearch('')
      setShowSugestoes(false)
      loadData()
    } catch {
      toast.error('Erro ao adicionar item')
    }
  }

  const handleDeleteItem = async (itemId: string) => {
    try {
      await deleteRomaneioItem(itemId)
      toast.success('Item removido')
      loadData()
    } catch (err) {
      toast.error('Erro ao excluir item')
    }
  }

  const handleToggleCarregado = async (item: RomaneioItem) => {
    try {
      await updateRomaneioItem(item.id, { carregado: !item.carregado })
      setItens((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, carregado: !i.carregado } : i)),
      )
      toast.success(!item.carregado ? 'Item marcado como carregado' : 'Item desmarcado')
    } catch {
      toast.error('Erro ao atualizar item')
    }
  }

  const handleUpdateRowHeight = async (itemId: string, height: number | null) => {
    // Atualização otimista imediata do estado local
    setItens((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, altura_linha: height || undefined } : i)),
    )
    try {
      await updateRomaneioItem(itemId, { altura_linha: height })
      if (height) {
        toast.success(`Altura da linha ajustada para ${height}px`)
      } else {
        toast.success('Altura da linha restaurada ao padrão')
      }
    } catch {
      toast.error('Erro ao salvar altura da linha')
    }
  }

  const handleDeleteRomaneio = async () => {
    try {
      await deleteRomaneio(romaneio.id)
      toast.success('Romaneio excluído')
      navigate(`/rotas/${encodeURIComponent(romaneio.rota)}`)
    } catch (err) {
      toast.error('Erro ao excluir romaneio')
    }
  }

  const handleCopyLink = () => {
    const url = `${window.location.origin}/romaneios/${romaneio.id}`
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true)
      toast.success('Link copiado!')
      setTimeout(() => setLinkCopied(false), 2000)
    })
  }

  const handleSendConclusion = () => {
    const phone = configContato.replace(/\D/g, '')
    if (!phone) {
      toast.error('Cadastre um telefone de contato na página Contato.')
      return
    }
    const msg = buildWhatsAppMessage(romaneio, itens, {
      statusText: isFinalizado ? 'Finalizado' : 'Em Andamento',
      conferente: romaneio.conferente,
    })
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const handleSaveObs = async () => {
    try {
      await updateRomaneio(romaneio.id, { observacoes: obsText })
      toast.success('Observações salvas!')
      setEditingObs(false)
      loadData()
    } catch {
      toast.error('Erro ao salvar observações')
    }
  }

  const handleSaveItemObs = async () => {
    if (!editingItemObs) return
    try {
      await updateRomaneioItem(editingItemObs.id, { observacao: editingItemObs.text })
      toast.success('Observação do item salva!')
      setEditingItemObs(null)
      loadData()
    } catch {
      toast.error('Erro ao salvar observação')
    }
  }

  const handleUpdateSecao = async (produtoId: string, novaSecao: string) => {
    const scrollY = window.scrollY
    const prevProdutos = produtos
    const prevItens = itens
    const previousProduto = produtos.find((p) => p.id === produtoId)
    const previousSecao = previousProduto?.secao

    const secaoVal = novaSecao === '__NONE' || !novaSecao ? undefined : normalizeSecao(novaSecao)
    if (secaoVal === previousSecao) return

    setUpdatingSecaoProdId(produtoId)

    // 1. Atualização otimista imediata do estado local
    setProdutos((prev) => prev.map((p) => (p.id === produtoId ? { ...p, secao: secaoVal } : p)))
    setItens((prev) =>
      prev.map((item) => {
        if (item.produto === produtoId && item.expand?.produto) {
          return {
            ...item,
            expand: {
              ...item.expand,
              produto: {
                ...item.expand.produto,
                secao: secaoVal,
              },
            },
          }
        }
        return item
      }),
    )

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollY)
      })
    })

    // 2. Mutação em background sem disparar loadData() completo
    try {
      await updateProduto(produtoId, { secao: secaoVal })
      toast.success('Seção atualizada com sucesso!')
    } catch (err) {
      // 3. Reverter estado local em caso de erro
      setProdutos(prevProdutos)
      setItens(prevItens)
      toast.error('Erro ao atualizar seção do produto')
    } finally {
      setUpdatingSecaoProdId(null)
    }
  }

  const getSecaoBadgeClass = (secao?: string) => {
    const norm = normalizeSecao(secao)
    switch (norm) {
      case 'CONGELADO':
        return 'bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100 font-semibold text-xs'
      case 'GERAL':
        return 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 font-semibold text-xs'
      case 'RESFRIADO':
        return 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 font-semibold text-xs'
      default:
        return 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 font-normal text-xs'
    }
  }

  const getItemQuantidade = (item: RomaneioItem): string => {
    const prod = item.expand?.produto
    const isUn = isUnidadeProduto(prod?.unidade_medida)

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

  return (
    <>
      <div className="space-y-6 print:hidden">
        {/* Header Navigation */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center gap-4">
            <Link
              to={`/rotas/${encodeURIComponent(romaneio.rota)}`}
              className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-slate-800 tracking-tight">
                  Romaneio #{romaneio.id.slice(-4).toUpperCase()}
                </h1>
                <RouteBadge rota={romaneio.rota} />
                {isFinalizado ? (
                  <Badge className="bg-emerald-500 text-white">Finalizado</Badge>
                ) : (
                  <Badge variant="outline" className="text-amber-600 border-amber-400 bg-amber-50">
                    Em Andamento
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span>Aberto em {new Date(romaneio.created).toLocaleString('pt-BR')}</span>
                <span>•</span>
                <span>{itens.length} produtos carregados</span>
                {isFinalizado && romaneio.conferente && (
                  <>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                      <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      Conferente: {romaneio.conferente}
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {!isFinalizado && (
              <>
                <Button
                  onClick={() => setImportWizardOpen(true)}
                  className="bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl"
                >
                  <FileSpreadsheet className="w-4 h-4 mr-2" /> Importar Planilha
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setManualItemModal(true)}
                  className="rounded-xl font-semibold"
                >
                  <Plus className="w-4 h-4 mr-1" /> Item Manual
                </Button>
                <div className="flex items-center gap-1">
                  <Input
                    readOnly
                    value={`${window.location.origin}/romaneios/${romaneio.id}`}
                    className="text-xs h-9 w-48 rounded-xl"
                    onClick={(e) => e.currentTarget.select()}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopyLink}
                    className="rounded-xl h-9 w-9"
                    title="Copiar link"
                  >
                    {linkCopied ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </>
            )}

            <Button
              variant="outline"
              onClick={handleSendConclusion}
              className="rounded-xl font-semibold text-blue-600 border-blue-400 hover:bg-blue-50"
            >
              <Send className="w-4 h-4 mr-1" /> Enviar conclusão via WhatsApp
            </Button>

            <Button
              variant="outline"
              onClick={() => window.print()}
              className="rounded-xl font-semibold"
            >
              <Printer className="w-4 h-4 mr-1" /> Imprimir
            </Button>

            <Button
              variant="outline"
              onClick={() => handleRefresh()}
              disabled={refreshing}
              className="rounded-xl font-semibold text-blue-600 border-blue-400 hover:bg-blue-50"
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} /> Atualizar
            </Button>

            <Button
              variant={isFinalizado ? 'outline' : 'default'}
              onClick={handleToggleStatus}
              className={
                isFinalizado
                  ? 'border-emerald-500 text-emerald-700'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }
            >
              {isFinalizado ? (
                <Unlock className="w-4 h-4 mr-1" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-1" />
              )}
              {isFinalizado ? 'Reabrir Carga' : 'Finalizar Carga'}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDeleteConfirmOpen(true)}
              className="text-slate-400 hover:text-red-500 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Totals Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
            <p className="text-xs font-semibold text-slate-400">PESO TOTAL DA CARGA</p>
            <p className="text-2xl font-black text-slate-800 tabular-nums mt-1">
              {formatWeight(totalPeso)} kg
            </p>
            {totalUnidades > 0 && (
              <p className="text-xs font-bold text-amber-700 mt-1">
                + {formatWeight(totalUnidades)} un (em unidades)
              </p>
            )}
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
            <p className="text-xs font-semibold text-slate-400">TOTAL DE CAIXAS</p>
            <p className="text-2xl font-black text-orange-600 tabular-nums mt-1">
              {totalCaixas} cx
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
            <p className="text-xs font-semibold text-slate-400">PEÇAS AVULSAS</p>
            <p className="text-2xl font-black text-blue-600 tabular-nums mt-1">{totalPecas} pct</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
            <p className="text-xs font-semibold text-slate-400">PRODUTOS DISTINTOS</p>
            <p className="text-2xl font-black text-slate-800 mt-1">{itens.length}</p>
          </div>
        </div>

        {/* Observations Section */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-base font-bold text-slate-800">Observações do Romaneio</h2>
            {!editingObs ? (
              !isFinalizado ? (
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
              ) : null
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

        {/* Items Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-base font-bold text-slate-800">Itens do Manifesto de Carga</h2>
            {isFinalizado && (
              <div className="flex items-center gap-3">
                {romaneio.conferente && (
                  <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-600" /> Conferente:{' '}
                    {romaneio.conferente}
                  </span>
                )}
                <span className="text-xs text-amber-600 font-semibold flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5" /> Romaneio finalizado (modo leitura)
                </span>
              </div>
            )}
          </div>

          {itens.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              Nenhum item adicionado a este romaneio. Importe uma planilha ou adicione manualmente.
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-12 text-center">Carregado</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Seção</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Marca</TableHead>
                  <TableHead className="text-right">Qtd / Peso</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedItens.map((item) => (
                  <ResizableTableRow
                    key={item.id}
                    item={item}
                    isFinalizado={isFinalizado}
                    updatingSecaoProdId={updatingSecaoProdId}
                    getSecaoBadgeClass={getSecaoBadgeClass}
                    getItemQuantidade={getItemQuantidade}
                    onToggleCarregado={handleToggleCarregado}
                    onUpdateSecao={handleUpdateSecao}
                    onEditItemObs={(it) =>
                      setEditingItemObs({ id: it.id, text: it.observacao || '' })
                    }
                    onDeleteItem={handleDeleteItem}
                    onUpdateRowHeight={handleUpdateRowHeight}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Manual Item Modal */}
      <Dialog
        open={manualItemModal}
        onOpenChange={(open) => {
          setManualItemModal(open)
          if (!open) {
            setSelectedProdutoId('')
            setPesoManual('')
            setProdutoSearch('')
            setShowSugestoes(false)
          }
        }}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Adicionar Item Manual</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddManualItem} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Produto (busca por código)</Label>
              <div className="relative" ref={produtoComboRef}>
                <Input
                  type="text"
                  value={selectedProd ? selectedProd.codigo || '' : produtoSearch}
                  onChange={(e) => {
                    setProdutoSearch(e.target.value)
                    setSelectedProdutoId('')
                    setShowSugestoes(true)
                  }}
                  onFocus={() => setShowSugestoes(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !selectedProdutoId && filteredProdutos.length > 0) {
                      e.preventDefault()
                      const p = filteredProdutos[0]
                      setSelectedProdutoId(p.id)
                      setProdutoSearch('')
                      setShowSugestoes(false)
                    }
                  }}
                  placeholder="Digite o código do produto..."
                  autoComplete="off"
                />
                {showSugestoes && (
                  <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
                    {filteredProdutos.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-slate-400">
                        Nenhum produto encontrado para o código informado.
                      </div>
                    ) : (
                      filteredProdutos.map((p) => (
                        <button
                          type="button"
                          key={p.id}
                          onClick={() => {
                            setSelectedProdutoId(p.id)
                            setProdutoSearch('')
                            setShowSugestoes(false)
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-100"
                        >
                          <span className="font-mono text-xs text-slate-500 tabular-nums">
                            {p.codigo || '-'}
                          </span>
                          <span className="flex-1 truncate text-sm text-slate-800">{p.nome}</span>
                          {p.marca ? (
                            <span className="text-xs text-slate-400">{p.marca}</span>
                          ) : null}
                          {p.peso_caixa_kg ? (
                            <span className="text-xs text-slate-400">Cx {p.peso_caixa_kg}kg</span>
                          ) : null}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              {selectedProd ? (
                <p className="text-xs text-slate-500">
                  Selecionado:{' '}
                  <span className="font-semibold text-slate-700">{selectedProd.nome}</span>
                  {selectedProd.peso_caixa_kg ? ` • Caixa ${selectedProd.peso_caixa_kg}kg` : ''}
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label>
                {selectedProd && isUnidadeProduto(selectedProd.unidade_medida)
                  ? 'Quantidade Total (unidades)'
                  : 'Peso Total da Carga (kg)'}
              </Label>
              <Input
                type="number"
                step="any"
                min="0.001"
                value={pesoManual}
                onChange={(e) => setPesoManual(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder={
                  selectedProd && isUnidadeProduto(selectedProd.unidade_medida)
                    ? 'Ex: 24 (copos/peças)'
                    : 'Ex: 100.555'
                }
                required
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setManualItemModal(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-orange-500 hover:bg-orange-600 text-white">
                Adicionar ao Romaneio
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ImportWizardModal
        open={importWizardOpen}
        onOpenChange={setImportWizardOpen}
        romaneioId={romaneio.id}
        produtos={produtos}
        existingItens={itens}
        onImportComplete={loadData}
      />

      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>Excluir Romaneio?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-500 py-2">
            Esta ação apagará permanentemente o romaneio e seus itens.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteRomaneio}>
              Excluir Definitivamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingItemObs} onOpenChange={(v) => !v && setEditingItemObs(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-4 h-4 text-blue-500" />
              Observação do Item
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
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
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              <Save className="w-4 h-4 mr-1" /> Salvar Observação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PrintManifest romaneio={romaneio} itens={sortedItens} />
    </>
  )
}
