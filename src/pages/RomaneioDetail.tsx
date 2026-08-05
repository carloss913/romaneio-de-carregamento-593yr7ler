import { useEffect, useState } from 'react'
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
  PackageCheck,
} from 'lucide-react'
import { Romaneio, RomaneioItem, Produto } from '@/types/database'
import { getRomaneio, updateRomaneio, deleteRomaneio } from '@/services/romaneios'
import {
  getRomaneioItens,
  createRomaneioItem,
  updateRomaneioItem,
  deleteRomaneioItem,
} from '@/services/romaneio_itens'
import { getProdutos } from '@/services/produtos'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { ImportWizardModal } from '@/components/ImportWizardModal'
import { PrintManifest } from '@/components/PrintManifest'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'

export default function RomaneioDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [romaneio, setRomaneio] = useState<Romaneio | null>(null)
  const [itens, setItens] = useState<RomaneioItem[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])

  const [importWizardOpen, setImportWizardOpen] = useState(false)
  const [manualItemModal, setManualItemModal] = useState(false)
  const [selectedProdutoId, setSelectedProdutoId] = useState('')
  const [pesoManual, setPesoManual] = useState<number | ''>('')

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  const sortedItens = [...itens].sort((a, b) => {
    const aCarregado = a.carregado ? 1 : 0
    const bCarregado = b.carregado ? 1 : 0
    if (aCarregado !== bCarregado) return aCarregado - bCarregado
    return new Date(a.created).getTime() - new Date(b.created).getTime()
  })

  const loadData = async () => {
    if (!id) return
    try {
      const rom = await getRomaneio(id)
      setRomaneio(rom)
      const listItens = await getRomaneioItens(id)
      setItens(listItens)
      const listProds = await getProdutos()
      setProdutos(listProds)
    } catch {
      /* intentionally ignored */
    }
  }

  useEffect(() => {
    loadData()
  }, [id])

  useRealtime('romaneios', () => loadData())
  useRealtime('romaneio_itens', () => loadData())

  if (!romaneio) return null

  const isFinalizado = romaneio.status === 'finalizado'

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
    } catch (_) {
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
      loadData()
    } catch (_) {
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
        description: !item.carregado ? 'Movido para o final da lista.' : undefined,
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
                Data: {new Date(romaneio.data).toLocaleDateString('pt-BR')} • {itens.length}{' '}
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
              </>
            )}

            <Button
              variant="outline"
              onClick={() => window.print()}
              className="rounded-xl font-semibold"
            >
              <Printer className="w-4 h-4 mr-1" /> Imprimir
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
                  <TableHead className="text-center">Caixas</TableHead>
                  <TableHead className="text-center">Peças Avulsas</TableHead>
                  <TableHead className="text-right">Conversão Final</TableHead>
                  {!isFinalizado && <TableHead className="text-right">Ação</TableHead>}
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
                    <TableCell className="text-center font-bold text-orange-600 tabular-nums">
                      {item.caixas} cx
                    </TableCell>
                    <TableCell className="text-center font-bold text-blue-600 tabular-nums">
                      {item.pecas} pct
                    </TableCell>
                    <TableCell className="text-right font-black text-slate-900">
                      {formatBoxesAndPieces(item.caixas, item.pecas)}
                    </TableCell>
                    {!isFinalizado && (
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteItem(item.id)}
                          className="text-slate-300 hover:text-red-500 hover:bg-red-50 h-8 w-8"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Manual Item Modal */}
      <Dialog open={manualItemModal} onOpenChange={setManualItemModal}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Adicionar Item Manual</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddManualItem} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Produto</Label>
              <Select value={selectedProdutoId} onValueChange={setSelectedProdutoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o produto..." />
                </SelectTrigger>
                <SelectContent>
                  {produtos
                    .filter((p) => p.ativo)
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome}
                        {p.peso_caixa_kg ? ` (Caixa ${p.peso_caixa_kg}kg)` : ''}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
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

      <PrintManifest romaneio={romaneio} itens={sortedItens} />
    </>
  )
}
