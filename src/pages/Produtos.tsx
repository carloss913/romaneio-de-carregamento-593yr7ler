import { useEffect, useState } from 'react'
import { Plus, Search, Edit2, Trash2, CheckCircle2, XCircle } from 'lucide-react'
import { Produto } from '@/types/database'
import { getProdutos, updateProduto, deleteProduto } from '@/services/produtos'
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
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'

export default function Produtos() {
  const { toast } = useToast()
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedProduto, setSelectedProduto] = useState<Produto | null>(null)

  const loadData = async () => {
    try {
      const list = await getProdutos()
      setProdutos(list)
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

  const filtered = produtos.filter((p) => p.nome.toLowerCase().includes(search.toLowerCase()))

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

        <Button
          onClick={() => {
            setSelectedProduto(null)
            setModalOpen(true)
          }}
          className="bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl shadow-md shadow-orange-500/20"
        >
          <Plus className="w-4 h-4 mr-2" /> Novo Produto
        </Button>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar produto por nome..."
          className="pl-9 bg-white rounded-xl border-slate-200"
        />
      </div>

      {/* Grid / Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead>Produto</TableHead>
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
                <TableCell colSpan={6} className="text-center py-8 text-slate-400">
                  Nenhum produto encontrado.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((p) => (
                <TableRow key={p.id} className={!p.ativo ? 'opacity-50 bg-slate-50' : ''}>
                  <TableCell className="font-bold text-slate-800">{p.nome}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {p.peso_caixa_kg.toFixed(1)} kg
                  </TableCell>
                  <TableCell className="text-center font-semibold tabular-nums">
                    {p.pecas_por_caixa}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums text-slate-600">
                    {p.peso_peca_kg.toFixed(2)} kg
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
    </div>
  )
}
