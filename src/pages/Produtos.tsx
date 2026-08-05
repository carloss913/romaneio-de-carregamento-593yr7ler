import { useEffect, useMemo, useState } from 'react'
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Upload,
  AlertCircle,
} from 'lucide-react'
import { Produto } from '@/types/database'
import { getProdutos, updateProduto, deleteProduto } from '@/services/produtos'
import { getConfiguracoes } from '@/services/configuracoes'
import pb from '@/lib/pocketbase/client'
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
import { ProdutoModal } from '@/components/ProdutoModal'
import { ImportProdutosModal } from '@/components/ImportProdutosModal'
import { ConfigPhoneModal } from '@/components/ConfigPhoneModal'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { Settings } from 'lucide-react'

export default function Produtos() {
  const { toast } = useToast()
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedProduto, setSelectedProduto] = useState<Produto | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [showIncomplete, setShowIncomplete] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)
  const [configPhone, setConfigPhone] = useState('')

  const isProdutoIncomplete = (p: Produto) =>
    !p.peso_caixa_kg ||
    p.peso_caixa_kg <= 0 ||
    !p.pecas_por_caixa ||
    p.pecas_por_caixa <= 0 ||
    !p.peso_peca_kg ||
    p.peso_peca_kg <= 0

  const loadData = async () => {
    try {
      const list = await getProdutos()
      setProdutos(list)
      try {
        const config = await getConfiguracoes()
        setConfigPhone(config?.telefone_whatsapp || '')
      } catch {
        /* no config yet */
      }
    } catch {
      /* intentionally ignored */
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useRealtime('produtos', () => loadData())

  const handleToggleStatus = async (p: Produto) => {
    try {
      await updateProduto(p.id, { ativo: !p.ativo })
      toast({
        title: 'Situação alterada',
        description: `${p.nome} está agora ${!p.ativo ? 'Ativo' : 'Inativo'}.`,
      })
      loadData()
    } catch (_) {
      toast({ title: 'Erro ao alterar situação', variant: 'destructive' })
    }
  }

  const handleDelete = async (p: Produto) => {
    try {
      // Check if used in romaneio_itens
      const count = await pb
        .collection('romaneio_itens')
        .getList(1, 1, { filter: `produto = "${p.id}"` })
      if (count.totalItems > 0) {
        toast({
          title: 'Produto em uso',
          description:
            'Este produto possui histórico em romaneios. Ele foi inativado em vez de excluído.',
        })
        await updateProduto(p.id, { ativo: false })
      } else {
        await deleteProduto(p.id)
        toast({ title: 'Produto excluído com sucesso' })
      }
      loadData()
    } catch (_) {
      toast({ title: 'Erro ao excluir produto', variant: 'destructive' })
    }
  }

  const filtered = useMemo(() => {
    const matched = produtos.filter(
      (p) =>
        p.nome.toLowerCase().includes(search.toLowerCase()) ||
        (p.codigo || '').toLowerCase().includes(search.toLowerCase()),
    )
    if (showIncomplete) {
      return [...matched].sort((a, b) => {
        const aIncomplete = isProdutoIncomplete(a)
        const bIncomplete = isProdutoIncomplete(b)
        if (aIncomplete === bIncomplete) return 0
        return aIncomplete ? -1 : 1
      })
    }
    return matched
  }, [produtos, search, showIncomplete])

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">
            Catálogo de Produtos
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Regras globais de conversão de peso da caixa e peças
          </p>
        </div>

        <div className="flex gap-2 items-center">
          <Button
            onClick={() => setImportOpen(true)}
            variant="outline"
            className="font-bold rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            <Upload className="w-4 h-4 mr-2" /> Importar Planilha
          </Button>
          <Button
            onClick={() => {
              setSelectedProduto(null)
              setModalOpen(true)
            }}
            className="bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl shadow-md shadow-orange-500/20"
          >
            <Plus className="w-4 h-4 mr-2" /> Novo Produto
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setConfigOpen(true)}
            className="text-slate-400 hover:text-slate-700"
            title={configPhone ? `Telefone: ${configPhone}` : 'Configurar telefone'}
          >
            <Settings className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative max-w-md flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por código ou nome..."
            className="pl-9 bg-white rounded-xl border-slate-200"
          />
        </div>
        <Button
          variant={showIncomplete ? 'default' : 'outline'}
          onClick={() => setShowIncomplete((v) => !v)}
          className={cn(
            'font-bold rounded-xl whitespace-nowrap',
            showIncomplete
              ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-500'
              : 'border-slate-300 text-slate-700 hover:bg-slate-50',
          )}
        >
          <AlertCircle className="w-4 h-4 mr-2" />
          {showIncomplete ? 'Filtrando Incompletos' : 'Sem conversão de peso'}
        </Button>
      </div>

      {/* Grid / Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead>Marca</TableHead>
              <TableHead className="text-right">Peso Caixa (kg)</TableHead>
              <TableHead className="text-center">Peças por Caixa</TableHead>
              <TableHead className="text-right">Peso Peça (kg)</TableHead>
              <TableHead className="text-center">Situação</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-slate-400">
                  Nenhum produto encontrado.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((p) => (
                <TableRow
                  key={p.id}
                  className={cn(
                    !p.ativo && 'opacity-50 bg-slate-50',
                    showIncomplete && isProdutoIncomplete(p) && 'bg-amber-50/60',
                  )}
                >
                  <TableCell className="font-mono text-xs text-slate-500 tabular-nums">
                    {p.codigo || '-'}
                  </TableCell>
                  <TableCell className="font-bold text-slate-800">{p.nome}</TableCell>
                  <TableCell className="text-slate-600 text-sm">{p.marca || '-'}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {p.peso_caixa_kg ? p.peso_caixa_kg.toFixed(1) + ' kg' : '-'}
                  </TableCell>
                  <TableCell className="text-center font-semibold tabular-nums">
                    {p.pecas_por_caixa || '-'}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums text-slate-600">
                    {p.peso_peca_kg ? p.peso_peca_kg.toFixed(2) + ' kg' : '-'}
                  </TableCell>
                  <TableCell className="text-center">
                    {p.ativo ? (
                      <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30">
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Ativo
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-slate-400 border-slate-300">
                        <XCircle className="w-3 h-3 mr-1" /> Inativo
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedProduto(p)
                        setModalOpen(true)
                      }}
                      className="h-8 w-8 text-slate-500 hover:text-slate-800"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleToggleStatus(p)}
                      className="h-8 w-8 text-slate-500 hover:text-orange-600"
                      title={p.ativo ? 'Inativar' : 'Ativar'}
                    >
                      {p.ativo ? (
                        <XCircle className="w-4 h-4" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(p)}
                      className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50"
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

      <ProdutoModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        produto={selectedProduto}
        onSuccess={loadData}
      />

      <ImportProdutosModal open={importOpen} onOpenChange={setImportOpen} onSuccess={loadData} />

      <ConfigPhoneModal open={configOpen} onOpenChange={setConfigOpen} onSuccess={loadData} />
    </div>
  )
}
