import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Produto, UnidadeMedida, normalizeSecao } from '@/types/database'
import { createProduto, updateProduto } from '@/services/produtos'
import { useToast } from '@/hooks/use-toast'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export interface InitialProdutoData {
  codigo?: string
  nome?: string
  marca?: string
  secao?: 'CONGELADO' | 'GERAL' | 'RESFRIADO' | string
  unidade_medida?: UnidadeMedida
  peso_caixa_kg?: number
  pecas_por_caixa?: number
  peso_peca_kg?: number
}

interface ProdutoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  produto?: Produto | null
  initialName?: string
  initialData?: InitialProdutoData | null
  onSuccess?: (produto: Produto) => void
}

export function ProdutoModal({
  open,
  onOpenChange,
  produto,
  initialName,
  initialData,
  onSuccess,
}: ProdutoModalProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [codigo, setCodigo] = useState('')
  const [nome, setNome] = useState('')
  const [marca, setMarca] = useState('')
  const [secao, setSecao] = useState<'CONGELADO' | 'GERAL' | 'RESFRIADO' | '__NONE'>('__NONE')
  const [unidadeMedida, setUnidadeMedida] = useState<UnidadeMedida>('kg')
  const [pesoCaixa, setPesoCaixa] = useState<number | ''>('')
  const [pecasPorCaixa, setPecasPorCaixa] = useState<number | ''>('')
  const [pesoPeca, setPesoPeca] = useState<number | ''>('')
  const [ativo, setAtivo] = useState(true)

  const isUnidade = unidadeMedida === 'unidade'
  const isPacote = unidadeMedida === 'pacote'
  const isNonKg = isUnidade || isPacote

  useEffect(() => {
    if (!open) return

    if (produto) {
      setCodigo(produto.codigo || '')
      setNome(produto.nome || '')
      setMarca(produto.marca || '')
      setSecao((normalizeSecao(produto.secao) as any) || '__NONE')
      setUnidadeMedida(produto.unidade_medida || 'kg')
      setPesoCaixa(produto.peso_caixa_kg ?? '')
      setPecasPorCaixa(produto.pecas_por_caixa ?? '')
      setPesoPeca(produto.peso_peca_kg ?? '')
      setAtivo(produto.ativo ?? true)
    } else {
      setCodigo(initialData?.codigo || '')
      setNome(initialData?.nome || initialName || '')
      setMarca(initialData?.marca || '')
      setSecao((normalizeSecao(initialData?.secao) as any) || '__NONE')
      setUnidadeMedida(initialData?.unidade_medida || 'kg')
      setPesoCaixa(initialData?.peso_caixa_kg ?? '')
      setPecasPorCaixa(initialData?.pecas_por_caixa ?? '')
      setPesoPeca(initialData?.peso_peca_kg ?? '')
      setAtivo(true)
    }
  }, [produto, initialName, initialData, open])

  const handleCaixaOrPecasChange = (caixaVal: number | '', pecasVal: number | '') => {
    const c = typeof caixaVal === 'number' ? caixaVal : 0
    const p = typeof pecasVal === 'number' ? pecasVal : 0
    if (c > 0 && p > 0) {
      setPesoPeca(parseFloat((c / p).toFixed(3)))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim()) {
      toast({
        title: 'Campo obrigatório',
        description: 'Informe o nome do produto.',
        variant: 'destructive',
      })
      return
    }
    setLoading(true)
    try {
      let saved: Produto
      const secaoVal = secao === '__NONE' ? undefined : secao

      if (produto) {
        saved = await updateProduto(produto.id, {
          codigo: codigo.trim(),
          nome: nome.trim(),
          marca: marca.trim(),
          secao: secaoVal,
          unidade_medida: unidadeMedida,
          peso_caixa_kg: isNonKg ? 0 : pesoCaixa === '' ? 0 : Number(pesoCaixa),
          pecas_por_caixa: pecasPorCaixa === '' ? 0 : Number(pecasPorCaixa),
          peso_peca_kg: isNonKg ? 0 : pesoPeca === '' ? 0 : Number(pesoPeca),
          ativo,
        })
        toast({ title: 'Produto atualizado!', description: `${saved.nome} foi salvo com sucesso.` })
      } else {
        saved = await createProduto({
          codigo: codigo.trim(),
          nome: nome.trim(),
          marca: marca.trim(),
          secao: secaoVal,
          unidade_medida: unidadeMedida,
          peso_caixa_kg: isNonKg ? 0 : pesoCaixa === '' ? 0 : Number(pesoCaixa),
          pecas_por_caixa: pecasPorCaixa === '' ? 0 : Number(pecasPorCaixa),
          peso_peca_kg: isNonKg ? 0 : pesoPeca === '' ? 0 : Number(pesoPeca),
          ativo,
        })
        toast({ title: 'Produto criado!', description: `${saved.nome} adicionado ao catálogo.` })
      }
      onSuccess?.(saved)
      onOpenChange(false)
    } catch (err) {
      toast({
        title: 'Erro ao salvar produto',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{produto ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="codigo">Código</Label>
              <Input
                id="codigo"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="Ex: 1374"
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="nome">
                Nome do Produto <span className="text-red-500">*</span>
              </Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Frango, Picanha..."
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="marca">Marca</Label>
              <Input
                id="marca"
                value={marca}
                onChange={(e) => setMarca(e.target.value)}
                placeholder="Ex: Seara, Friboi..."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="secao">Seção</Label>
              <Select value={secao} onValueChange={(val: any) => setSecao(val)}>
                <SelectTrigger id="secao">
                  <SelectValue placeholder="Selecione a seção" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__NONE">Nenhuma / Padrão</SelectItem>
                  <SelectItem value="CONGELADO">CONGELADO</SelectItem>
                  <SelectItem value="GERAL">GERAL</SelectItem>
                  <SelectItem value="RESFRIADO">RESFRIADO</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="unidadeMedida">Unidade de Medida</Label>
              <Select
                value={unidadeMedida}
                onValueChange={(val: UnidadeMedida) => setUnidadeMedida(val)}
              >
                <SelectTrigger id="unidadeMedida" className="font-semibold">
                  <SelectValue placeholder="Selecione a unidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kg">KG</SelectItem>
                  <SelectItem value="unidade">Unidade (peças/copos)</SelectItem>
                  <SelectItem value="pacote">Pacote (pct)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isPacote ? (
            <div className="p-3 bg-purple-50/70 border border-purple-200/80 rounded-xl space-y-3">
              <div className="text-xs text-purple-900">
                <strong>Produto em Pacote (pct):</strong> A quantidade na planilha é tratada em
                unidades/espetos (ex.: 10 espetos). Sem conversão de peso em kg.
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pecasPorCaixa" className="text-purple-950 font-bold">
                  Unidades por Pacote{' '}
                  <span className="text-xs text-slate-400 font-normal">(opcional)</span>
                </Label>
                <Input
                  id="pecasPorCaixa"
                  type="number"
                  step="1"
                  min="0"
                  value={pecasPorCaixa}
                  placeholder="Ex: 5 (5 espetos por pacote)"
                  onChange={(e) => {
                    const val = e.target.value === '' ? '' : Number(e.target.value)
                    setPecasPorCaixa(val)
                  }}
                  className="bg-white border-purple-300"
                />
                <p className="text-[11px] text-purple-700">
                  Pacotes são lacrados (não vende soltas). Ex.: 10 espetos com 5/pct = 2 pct. Se a
                  quantidade não fechar em pacotes inteiros, o sistema emitirá alerta de conferência
                  de peso.
                </p>
              </div>
            </div>
          ) : isUnidade ? (
            <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl space-y-3">
              <div className="text-xs text-amber-800">
                <strong>Produto em Unidade:</strong> A quantidade na planilha é tratada em unidades
                (ex.: 24 copos de água de coco). Sem conversão de peso em kg.
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pecasPorCaixa" className="text-amber-950 font-bold">
                  Unidades na Caixa{' '}
                  <span className="text-xs text-slate-400 font-normal">(opcional)</span>
                </Label>
                <Input
                  id="pecasPorCaixa"
                  type="number"
                  step="1"
                  min="0"
                  value={pecasPorCaixa}
                  placeholder="Ex: 12 (12 unidades por caixa)"
                  onChange={(e) => {
                    const val = e.target.value === '' ? '' : Number(e.target.value)
                    setPecasPorCaixa(val)
                  }}
                  className="bg-white border-amber-300"
                />
                <p className="text-[11px] text-amber-700">
                  Ex.: se a caixa tem 12 unidades e a quantidade for 24, calcula 2 cx.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="pesoCaixa">Peso da Caixa (kg)</Label>
                  <Input
                    id="pesoCaixa"
                    type="number"
                    step="any"
                    value={pesoCaixa}
                    placeholder="Ex: 20"
                    onChange={(e) => {
                      const val = e.target.value === '' ? '' : Number(e.target.value)
                      setPesoCaixa(val)
                      handleCaixaOrPecasChange(val, pecasPorCaixa)
                    }}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="pecasPorCaixa">Peças por Caixa</Label>
                  <Input
                    id="pecasPorCaixa"
                    type="number"
                    step="any"
                    value={pecasPorCaixa}
                    placeholder="Ex: 10"
                    onChange={(e) => {
                      const val = e.target.value === '' ? '' : Number(e.target.value)
                      setPecasPorCaixa(val)
                      handleCaixaOrPecasChange(pesoCaixa, val)
                    }}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pesoPeca">
                  Peso da Peça (kg) <span className="text-xs text-slate-400">(opcional)</span>
                </Label>
                <Input
                  id="pesoPeca"
                  type="number"
                  step="any"
                  value={pesoPeca}
                  placeholder="Ex: 2.0"
                  onChange={(e) => setPesoPeca(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>
            </>
          )}

          <div className="flex items-center justify-between pt-2 border-t">
            <Label htmlFor="ativo" className="cursor-pointer">
              Situação: {ativo ? 'Ativo' : 'Inativo'}
            </Label>
            <Switch id="ativo" checked={ativo} onCheckedChange={setAtivo} />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-orange-500 hover:bg-orange-600 text-white font-semibold"
            >
              {loading ? 'Salvando...' : produto ? 'Atualizar' : 'Criar Produto'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
