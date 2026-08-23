import { useState, useEffect } from 'react'
import { Upload, FileSpreadsheet, X, ArrowRight, ArrowLeft, Trash2 } from 'lucide-react'
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
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table'
import { Produto, normalizeSecao } from '@/types/database'
import { getProdutos, createProduto, updateProduto } from '@/services/produtos'
import { parseExcelOrCsvFile, ParsedSheetData } from '@/lib/excel-parser'
import {
  ProductField,
  PRODUCT_FIELDS,
  autoSuggestMappings,
  processRows,
  validateRows,
  ProductRow,
} from '@/lib/product-import'
import { useToast } from '@/hooks/use-toast'
import { getErrorMessage } from '@/lib/pocketbase/errors'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

const EMPTY_MAP: Record<ProductField, string> = {
  codigo: '',
  nome: '',
  secao: '',
  peso_caixa_kg: '',
  peso_peca_kg: '',
  pecas_por_caixa: '',
}

export function ImportProdutosModal({ open, onOpenChange, onSuccess }: Props) {
  const { toast } = useToast()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [file, setFile] = useState<File | null>(null)
  const [parsedData, setParsedData] = useState<ParsedSheetData | null>(null)
  const [mappings, setMappings] = useState<Record<ProductField, string>>(EMPTY_MAP)
  const [rows, setRows] = useState<ProductRow[]>([])
  const [loading, setLoading] = useState(false)
  const [existing, setExisting] = useState<Produto[]>([])

  const reset = () => {
    setStep(1)
    setFile(null)
    setParsedData(null)
    setRows([])
    setMappings(EMPTY_MAP)
  }

  useEffect(() => {
    if (open)
      getProdutos()
        .then(setExisting)
        .catch(() => {})
    else reset()
  }, [open])

  const handleFile = async (f: File) => {
    setFile(f)
    setLoading(true)
    try {
      const data = await parseExcelOrCsvFile(f)
      if (!data.rows.length) {
        toast({
          title: 'Arquivo vazio',
          description: 'A planilha deve ter ao menos uma linha de dados.',
          variant: 'destructive',
        })
        return
      }
      setParsedData(data)
      setMappings(autoSuggestMappings(data.headers))
      setStep(2)
    } catch (err) {
      toast({
        title: 'Erro ao ler arquivo',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const goReview = () => {
    if (!parsedData) return
    setRows(validateRows(processRows(parsedData, mappings, existing)))
    setStep(3)
  }

  const updateRow = (id: string, field: keyof ProductRow, value: string) =>
    setRows((prev) => validateRows(prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))))

  const removeRow = (id: string) => setRows((prev) => validateRows(prev.filter((r) => r.id !== id)))

  const validCount = rows.filter((r) => !Object.keys(r.errors).length).length

  const handleConfirm = async () => {
    const valid = rows.filter((r) => !Object.keys(r.errors).length)
    if (!valid.length) return
    setLoading(true)
    let created = 0,
      updated = 0
    let failed = 0
    const BATCH_SIZE = 8
    const DELAY_MS = 200

    const executeWithRetry = async <T,>(
      operation: () => Promise<T>,
      maxRetries = 3,
    ): Promise<T> => {
      let attempt = 0
      while (attempt < maxRetries) {
        try {
          return await operation()
        } catch (err: unknown) {
          attempt++
          const is429 =
            err && typeof err === 'object' && 'status' in err && (err as any).status === 429

          if (is429 && attempt < maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, 1000))
            continue
          }
          throw err
        }
      }
      throw new Error('Número máximo de tentativas atingido.')
    }

    try {
      for (let i = 0; i < valid.length; i += BATCH_SIZE) {
        const batch = valid.slice(i, i + BATCH_SIZE)
        const batchResults = await Promise.allSettled(
          batch.map(async (r) => {
            const num = (s: string) => parseFloat(s.replace(',', '.'))

            if (r.status === 'atualizar' && r.existingId) {
              const ex = existing.find((p) => p.id === r.existingId)
              const updateData: Record<string, unknown> = { ativo: ex?.ativo ?? true }

              if (mappings.codigo && r.codigo.trim()) updateData.codigo = r.codigo
              if (mappings.nome && r.nome.trim()) updateData.nome = r.nome
              if (mappings.secao && r.secao.trim()) {
                updateData.secao = normalizeSecao(r.secao) || r.secao.trim().toUpperCase()
              }
              if (mappings.peso_caixa_kg && r.peso_caixa_kg.trim()) {
                updateData.peso_caixa_kg = num(r.peso_caixa_kg)
              }
              if (mappings.peso_peca_kg && r.peso_peca_kg.trim()) {
                updateData.peso_peca_kg = num(r.peso_peca_kg)
              }
              if (mappings.pecas_por_caixa && r.pecas_por_caixa.trim()) {
                updateData.pecas_por_caixa = parseFloat(r.pecas_por_caixa.replace(',', '.')) || 0
              }

              await executeWithRetry(() => updateProduto(r.existingId!, updateData))
              return { type: 'updated' as const }
            } else {
              const pc = r.peso_caixa_kg.trim() ? num(r.peso_caixa_kg) : 0
              const pp = r.peso_peca_kg.trim() ? num(r.peso_peca_kg) : 0
              let pecasPorCaixa = 0
              if (r.pecas_por_caixa.trim()) {
                pecasPorCaixa = parseFloat(r.pecas_por_caixa.replace(',', '.')) || 0
              } else if (pp > 0 && pc > 0) {
                pecasPorCaixa = Math.round(pc / pp)
              }
              const normSecao = normalizeSecao(r.secao)
              const data = {
                codigo: r.codigo,
                nome: r.nome,
                secao: normSecao,
                peso_caixa_kg: pc,
                peso_peca_kg: pp,
                pecas_por_caixa: pecasPorCaixa,
                ativo: true,
              }
              await executeWithRetry(() => createProduto(data))
              return { type: 'created' as const }
            }
          }),
        )

        batchResults.forEach((res, batchIdx) => {
          if (res.status === 'fulfilled') {
            if (res.value.type === 'created') created++
            else updated++
          } else {
            failed++
            const rowItem = batch[batchIdx]
            toast({
              title: `Falha ao importar produto [${rowItem.codigo || rowItem.nome}]`,
              description: getErrorMessage(res.reason),
              variant: 'destructive',
            })
          }
        })

        if (i + BATCH_SIZE < valid.length) {
          await new Promise((resolve) => setTimeout(resolve, DELAY_MS))
        }
      }

      if (failed > 0) {
        toast({
          title: created + updated > 0 ? 'Importação parcial concluída' : 'Erro na importação',
          description: `${created} criado(s), ${updated} atualizado(s), ${failed} falha(s).`,
          variant: created + updated > 0 ? 'default' : 'destructive',
        })
      } else {
        toast({
          title: 'Importação concluída!',
          description: `${created} produto(s) criado(s) e ${updated} atualizado(s).`,
        })
      }

      if (created + updated > 0) {
        onSuccess()
        onOpenChange(false)
        reset()
      }
    } catch (err) {
      toast({
        title: 'Erro na importação',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const errClass = (errors: Record<string, string>, field: string) =>
    errors[field] ? 'border-red-500' : ''

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset()
        onOpenChange(v)
      }}
    >
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-orange-500" />
            Importar Planilha de Produtos
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2 text-center text-xs font-semibold py-2 border-b">
          {['1. Enviar planilha', '2. Mapear colunas', '3. Revisar e importar'].map((lbl, i) => (
            <div
              key={lbl}
              className={`py-1.5 rounded-md ${step === i + 1 ? 'bg-orange-500 text-white' : step > i + 1 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-400'}`}
            >
              {lbl}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto py-3 space-y-4">
          {step === 1 && (
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center flex flex-col items-center gap-3 bg-slate-50">
              <Upload className="w-10 h-10 text-orange-500" />
              {file ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-700">{file.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => {
                      setFile(null)
                      setParsedData(null)
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div>
                  <p className="font-semibold text-slate-700">Selecione sua planilha de produtos</p>
                  <p className="text-xs text-slate-400 mt-1">Formatos aceitos: .xlsx, .xls, .csv</p>
                </div>
              )}
              <label className="cursor-pointer">
                <Input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
                <Button type="button" variant="outline" className="pointer-events-none">
                  {file ? 'Trocar Arquivo' : 'Escolher Arquivo'}
                </Button>
              </label>
              {loading && <p className="text-xs text-slate-400">Processando...</p>}
            </div>
          )}

          {step === 2 && parsedData && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Mapeie as colunas da planilha para os campos do produto. Sugestões automáticas já
                foram aplicadas:
              </p>
              <div className="space-y-3">
                {PRODUCT_FIELDS.map((f) => (
                  <div key={f.key} className="grid grid-cols-2 gap-4 items-center">
                    <Label className="text-sm">
                      {f.label}
                      {f.required && <span className="text-red-500"> *</span>}
                    </Label>
                    <Select
                      value={mappings[f.key]}
                      onValueChange={(v) =>
                        setMappings((m) => ({ ...m, [f.key]: v === '__none' ? '' : v }))
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Não mapear" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">Não mapear</SelectItem>
                        {parsedData.headers.map((h) => (
                          <SelectItem key={h} value={h}>
                            {h}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              {!mappings.pecas_por_caixa && (
                <p className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                  Peças por Caixa será calculado automaticamente como Peso da Caixa ÷ Peso da Peça.
                </p>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">
                {validCount === rows.length
                  ? `${validCount} linha(s) válida(s) e pronta(s) para importação.`
                  : `${validCount} de ${rows.length} linha(s) válida(s). Linhas com erro não serão importadas.`}
              </p>
              <div className="border rounded-lg overflow-auto max-h-[400px]">
                <Table className="text-xs">
                  <TableHeader className="bg-slate-100 sticky top-0">
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Seção</TableHead>
                      <TableHead>Peso Caixa</TableHead>
                      <TableHead>Peças/Cx</TableHead>
                      <TableHead>Peso Peça</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <Input
                            value={r.codigo}
                            onChange={(e) => updateRow(r.id, 'codigo', e.target.value)}
                            className={`h-7 w-20 text-xs ${errClass(r.errors, 'codigo')}`}
                          />
                          {r.errors.codigo && (
                            <span className="text-[10px] text-red-500 block">
                              {r.errors.codigo}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Input
                            value={r.nome}
                            onChange={(e) => updateRow(r.id, 'nome', e.target.value)}
                            className={`h-7 w-32 text-xs ${errClass(r.errors, 'nome')}`}
                          />
                          {r.errors.nome && (
                            <span className="text-[10px] text-red-500 block">{r.errors.nome}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Input
                            value={r.secao}
                            onChange={(e) => updateRow(r.id, 'secao', e.target.value)}
                            className="h-7 w-24 text-xs"
                            placeholder="-"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={r.peso_caixa_kg}
                            onChange={(e) => updateRow(r.id, 'peso_caixa_kg', e.target.value)}
                            className={`h-7 w-16 text-xs ${errClass(r.errors, 'peso_caixa_kg')}`}
                          />
                          {r.errors.peso_caixa_kg && (
                            <span className="text-[10px] text-red-500 block">
                              {r.errors.peso_caixa_kg}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Input
                            value={r.pecas_por_caixa}
                            onChange={(e) => updateRow(r.id, 'pecas_por_caixa', e.target.value)}
                            className={`h-7 w-14 text-xs ${errClass(r.errors, 'pecas_por_caixa')}`}
                          />
                          {r.errors.pecas_por_caixa && (
                            <span className="text-[10px] text-red-500 block">
                              {r.errors.pecas_por_caixa}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Input
                            value={r.peso_peca_kg}
                            onChange={(e) => updateRow(r.id, 'peso_peca_kg', e.target.value)}
                            className={`h-7 w-16 text-xs ${errClass(r.errors, 'peso_peca_kg')}`}
                          />
                          {r.errors.peso_peca_kg && (
                            <span className="text-[10px] text-red-500 block">
                              {r.errors.peso_peca_kg}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {r.status === 'novo' ? (
                            <Badge className="bg-emerald-500/10 text-emerald-700">
                              Será criado
                            </Badge>
                          ) : (
                            <Badge className="bg-blue-500/10 text-blue-700">Será atualizado</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-400 hover:text-red-600"
                            onClick={() => removeRow(r.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="pt-3 border-t">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
            </Button>
          )}
          {step === 2 && (
            <Button
              onClick={goReview}
              disabled={!mappings.codigo || !mappings.nome}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              Processar <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          )}
          {step === 3 && (
            <Button
              onClick={handleConfirm}
              disabled={loading || validCount === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {loading ? 'Importando...' : `Confirmar Importação (${validCount})`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
