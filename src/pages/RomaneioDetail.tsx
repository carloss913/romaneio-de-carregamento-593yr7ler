import { useEffect, useState, useRef } from 'react'
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
  Settings,
  Save,
  X,
  Pencil,
  RefreshCw,
} from 'lucide-react'
import { Romaneio, RomaneioItem, Produto, getSecaoOrder } from '@/types/database'
import { getRomaneio, updateRomaneio, deleteRomaneio } from '@/services/romaneios'
import {
  getRomaneioItens,
  createRomaneioItem,
  updateRomaneioItem,
  deleteRomaneioItem,
} from '@/services/romaneio_itens'
import { getProdutos } from '@/services/produtos'
import { getConfiguracoes } from '@/services/configuracoes'
import { refreshRomaneioItens } from '@/services/romaneio_itens'
import { convertWeightToBoxesAndPieces, formatBoxesAndPieces } from '@/lib/conversion'
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
import { ConfigPhoneModal } from '@/components/ConfigPhoneModal'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'

export default function RomaneioDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [romaneio, setRomaneio] = useState<Romaneio | null>(null)
  const [itens, setItens] = useState<RomaneioItem[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [configPhone, setConfigPhone] = useState('')
  const [configContato, setConfigContato] = useState('')
  const [configOpen, setConfigOpen] = useState(false)

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

  const handleRefresh = async (showToast = true) => {
    if (refreshingRef.current || !romaneio) return
    refreshingRef.current = true
    setRefreshing(true)
    try {
      const freshProdutos = await getProdutos()
      setProdutos(freshProdutos)
      const updatedCount = await refreshRomaneioItens(itens, freshProdutos)
      if (showToast) {
        toast({
          title:
            updatedCount > 0
              ? `${updatedCount} item(ns) atualizado(s) com os dados mais recentes.`
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
      const listProds = await getProdutos()
      setProdutos(listProds)
      try {
        const config = await getConfiguracoes()
        setConfigPhone(config?.telefone_whatsapp || '')
        setConfigContato(config?.telefone_contato || '')
      } catch {
        /* no config yet */
      }
    } catch {
      /* intentionally ignored */
    }
  }

  useEffect(() => {
    loadData()
  }, [id])

  useRealtime('romaneios', () => loadData())
  useRealtime('romaneio_itens', () => loadData())
  useRealtime('produtos', () => handleRefresh(false))

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

  const totalPeso = itens.reduce((a, b) => a + b.peso_total_kg, 0)
  const totalCaixas = itens.reduce((a, b) => a + b.caixas, 0)
  const totalPecas = itens.reduce((a, b) => a + b.pecas, 0)

  const handleToggleStatus = async () => {
    const nextStatus = isFinalizado ? 'em_andamento' : 'finalizado'
    try {
      await updateRomaneio(romaneio.id, { status: nextStatus })
      toast({
        title: isFinalizado ? 'Romaneio Reaberto' : 'Romaneio Finalizado',
        description: isFinalizado ? 'Edições liberadas.' : 'Carga bloqueada para alterações.',
      })
      loadData()
    } catch {
      toast({ title: 'Erro ao alterar status', variant: 'destructive' })
    }
  }

  const handleAddManualItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProdutoId || !pesoManual || pesoManual <= 0) return
    const prod = produtos.find((p) => p.id === selectedProdutoId)
    if (!prod) return

    const conv = convertWeightToBoxesAndPieces(
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
      toast({ title: 'Item adicionado!' })
      setManualItemModal(false)
      setSelectedProdutoId('')
      setPesoManual('')
      setProdutoSearch('')
      setShowSugestoes(false)
      loadData()
    } catch {
      toast({ title: 'Erro ao adicionar item', variant: 'destructive' })
    }
  }

  const handleDeleteItem = async (itemId: string) => {
    try {
      await deleteRomaneioItem(itemId)
      toast({ title: 'Item removido' })
      loadData()
    } catch {
      /* intentionally ignored */
    }
  }

  const handleToggleCarregado = async (item: RomaneioItem) => {
    try {
      await updateRomaneioItem(item.id, { carregado: !item.carregado })
      setItens((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, carregado: !i.carregado } : i)),
      )
      toast({
        title: !item.carregado ? 'Item marcado como carregado' : 'Item desmarcado',
      })
    } catch {
      toast({ title: 'Erro ao atualizar item', variant: 'destructive' })
    }
  }

  const handleDeleteRomaneio = async () => {
    try {
      await deleteRomaneio(romaneio.id)
      toast({ title: 'Romaneio excluído' })
      navigate(`/rotas/${encodeURIComponent(romaneio.rota)}`)
    } catch {
      /* intentionally ignored */
    }
  }

  const handleCopyLink = () => {
    const url = `${window.location.origin}/romaneios/${romaneio.id}`
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true)
      toast({ title: 'Link copiado!' })
      setTimeout(() => setLinkCopied(false), 2000)
    })
  }

  const handleSendConclusion = () => {
    const phone = configContato.replace(/\D/g, '')
    if (!phone) {
      toast({
        title: 'Contato não cadastrado',
        description: 'Cadastre um telefone de contato na página Contato.',
        variant: 'destructive',
      })
      return
    }
    const msg = buildWhatsAppMessage(romaneio, itens, {
      statusText: isFinalizado ? 'Finalizado' : 'Em Andamento',
    })
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const handleSaveObs = async () => {
    try {
      await updateRomaneio(romaneio.id, { observacoes: obsText })
      toast({ title: 'Observações salvas!' })
      setEditingObs(false)
      loadData()
    } catch {
      toast({ title: 'Erro ao salvar observações', variant: 'destructive' })
    }
  }

  const handleSaveItemObs = async () => {
    if (!editingItemObs) return
    try {
      await updateRomaneioItem(editingItemObs.id, { observacao: editingItemObs.text })
      toast({ title: 'Observação do item salva!' })
      setEditingItemObs(null)
      loadData()
    } catch {
      toast({ title: 'Erro ao salvar observação', variant: 'destructive' })
    }
  }

  const getItemQuantidade = (item: RomaneioItem): string => {
    if (!item.expand?.produto?.peso_caixa_kg || item.expand?.produto?.peso_caixa_kg <= 0) {
      return `${item.peso_total_kg.toFixed(1)} kg`
    }
    return formatBoxesAndPieces(item.caixas, item.pecas)
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
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Aberto em {new Date(romaneio.created).toLocaleString('pt-BR')} • {itens.length}{' '}
                produtos carregados
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
              onClick={() => setConfigOpen(true)}
              className="text-slate-400 hover:text-slate-700"
              title="Configurar telefone"
            >
              <Settings className="w-4 h-4" />
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
              {totalPeso.toFixed(1)} kg
            </p>
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
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-800">Itens do Manifesto de Carga</h2>
            {isFinalizado && (
              <span className="text-xs text-amber-600 font-semibold flex items-center gap-1">
                <Lock className="w-3.5 h-3.5" /> Romaneio finalizado (modo leitura)
              </span>
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
                  <TableHead>Descrição</TableHead>
                  <TableHead>Marca</TableHead>
                  <TableHead className="text-right">Peso Total (kg)</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                  <TableHead>Obs.</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedItens.map((item) => (
                  <TableRow key={item.id} className={item.carregado ? 'opacity-50' : ''}>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center">
                        <Checkbox
                          checked={item.carregado}
                          onCheckedChange={() => handleToggleCarregado(item)}
                          disabled={isFinalizado}
                          className={
                            item.carregado ? 'border-emerald-500 bg-emerald-500 text-white' : ''
                          }
                        />
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-500 tabular-nums">
                      {item.expand?.produto?.codigo || '-'}
                    </TableCell>
                    <TableCell
                      className={`font-bold text-slate-800 ${
                        item.carregado ? 'line-through text-slate-400' : ''
                      }`}
                    >
                      {item.expand?.produto?.nome || 'Produto'}
                    </TableCell>
                    <TableCell className="text-slate-600 text-sm">
                      {item.expand?.produto?.marca || '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {item.peso_total_kg.toFixed(1)} kg
                    </TableCell>
                    <TableCell className="text-right font-black text-slate-900">
                      {getItemQuantidade(item)}
                    </TableCell>
                    <TableCell className="text-xs text-slate-500 max-w-[160px] truncate">
                      {item.observacao || '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {!isFinalizado && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setEditingItemObs({ id: item.id, text: item.observacao || '' })
                            }
                            className="text-slate-400 hover:text-blue-500 hover:bg-blue-50 h-8 w-8"
                            title="Editar observação do item"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                        )}
                        {!isFinalizado && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteItem(item.id)}
                            className="text-slate-300 hover:text-red-500 hover:bg-red-50 h-8 w-8"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
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
              <Label>Peso Total da Carga (kg)</Label>
              <Input
                type="number"
                step="0.1"
                min="0.1"
                value={pesoManual}
                onChange={(e) => setPesoManual(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Ex: 100.5"
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

      <ConfigPhoneModal
        open={configOpen}
        onOpenChange={setConfigOpen}
        onSuccess={() => loadData()}
      />

      <PrintManifest romaneio={romaneio} itens={sortedItens} />
    </>
  )
}
