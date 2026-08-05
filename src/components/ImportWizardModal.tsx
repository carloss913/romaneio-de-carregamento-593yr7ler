import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table'
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Plus,
  Trash2,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Produto, RomaneioItem } from '@/types/database'
import { parseExcelOrCsvFile, ParsedSheetData } from '@/lib/excel-parser'
import { convertWeightToBoxesAndPieces, parseBrazilianWeight } from '@/lib/conversion'
import { createRomaneioItem, deleteItensByRomaneio } from '@/services/romaneio_itens'
import { updateRomaneio } from '@/services/romaneios'
import { updateProduto, createProduto } from '@/services/produtos'
import { ProdutoModal } from './ProdutoModal'
import { useToast } from '@/hooks/use-toast'
import { getErrorMessage } from '@/lib/pocketbase/errors'

interface ImportWizardModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  romaneioId: string
  produtos: Produto[]
  existingItens: RomaneioItem[]
  onImportComplete: () => void
}

interface ProcessedRow {
  id: string
  rawCode: string
  pesoKg: number
  nomeFromSheet?: string
  matchedProduto?: Produto
  matchStatus: 'ok' | 'auto_cadastrar' | 'peso_invalido'
  weightWarning: boolean
  weightWarningMessage?: string
  caixas: number
  pecas: number
  textoFormatado: string
  marca?: string
  secao?: string
}

export function ImportWizardModal({
  open,
  onOpenChange,
  romaneioId,
  produtos,
  existingItens,
  onImportComplete,
}: ImportWizardModalProps) {
  const { toast } = useToast()
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [file, setFile] = useState<File | null>(null)
  const [parsedData, setParsedData] = useState<ParsedSheetData | null>(null)
  const [colProduto, setColProduto] = useState<string>('')
  const [colPeso, setColPeso] = useState<string>('')
  const [colMarca, setColMarca] = useState<string>('')
  const [colNome, setColNome] = useState<string>('')
  const [colSecao, setColSecao] = useState<string>('')
  const [processedRows, setProcessedRows] = useState<ProcessedRow[]>([])
  const [substituir, setSubstituir] = useState(false)
  const [loading, setLoading] = useState(false)
  const [weightAcknowledged, setWeightAcknowledged] = useState(false)
  const [novoProdutoModal, setNovoProdutoModal] = useState<{
    open: boolean
    initialName: string
    rowId?: string
  }>({ open: false, initialName: '' })

  const blockedRows = processedRows.filter((r) => r.matchStatus === 'peso_invalido')
  const autoCadastrarRows = processedRows.filter((r) => r.matchStatus === 'auto_cadastrar')
  const weightWarningRows = processedRows.filter((r) => r.matchStatus === 'ok' && r.weightWarning)
  const validRows = processedRows.filter((r) => r.matchStatus === 'ok')

  const resetWizard = () => {
    setStep(1)
    setFile(null)
    setParsedData(null)
    setColProduto('')
    setColPeso('')
    setColMarca('')
    setColNome('')
    setColSecao('')
    setProcessedRows([])
    setSubstituir(false)
    setWeightAcknowledged(false)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0]
    if (!uploadedFile) return
    setFile(uploadedFile)
    setLoading(true)
    try {
      const data = await parseExcelOrCsvFile(uploadedFile)
      setParsedData(data)
      setColProduto(data.headers[0] || '')
      setColPeso(data.headers[16] || data.headers[1] || '')
      setColMarca(data.headers[10] || '')
      setColNome(data.headers[3] || data.headers[1] || '')
      setColSecao(data.headers.find((h: string) => /se[çc][ãa]o/i.test(h)) || '')
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

  const applyConversion = (row: ProcessedRow, produto: Produto, pesoKg: number): ProcessedRow => {
    if (!produto.peso_caixa_kg || produto.peso_caixa_kg <= 0) {
      return {
        ...row,
        matchedProduto: produto,
        matchStatus: 'ok',
        weightWarning: false,
        caixas: 0,
        pecas: 0,
        textoFormatado: `${pesoKg.toFixed(1)} kg`,
      }
    }
    const conv = convertWeightToBoxesAndPieces(
      pesoKg,
      produto.peso_caixa_kg,
      produto.peso_peca_kg,
      produto.pecas_por_caixa,
    )
    return {
      ...row,
      matchedProduto: produto,
      matchStatus: pesoKg <= 0 ? 'peso_invalido' : 'ok',
      weightWarning: conv.weightWarning,
      weightWarningMessage: conv.weightWarningMessage,
      caixas: conv.caixas,
      pecas: conv.pecas,
      textoFormatado: conv.textoFormatado,
    }
  }

  const processSheetRows = () => {
    if (!parsedData || !colProduto || !colPeso) return
    const aggregated: Record<
      string,
      { rawCode: string; pesoTotal: number; marca: string; nome: string; secao: string }
    > = {}

    parsedData.rows.forEach((row) => {
      const code = (row[colProduto] || '').trim()
      const weightRaw = row[colPeso] || ''
      if (!code) return
      const weight = parseBrazilianWeight(weightRaw)
      const marcaVal = colMarca ? (row[colMarca] || '').trim() : ''
      const nomeVal = colNome ? (row[colNome] || '').trim() : ''
      const secaoVal = colSecao ? (row[colSecao] || '').trim() : ''
      if (aggregated[code]) {
        aggregated[code].pesoTotal += weight
        if (marcaVal && !aggregated[code].marca) {
          aggregated[code].marca = marcaVal
        }
        if (nomeVal && !aggregated[code].nome) {
          aggregated[code].nome = nomeVal
        }
        if (secaoVal && !aggregated[code].secao) {
          aggregated[code].secao = secaoVal
        }
      } else {
        aggregated[code] = {
          rawCode: code,
          pesoTotal: weight,
          marca: marcaVal,
          nome: nomeVal,
          secao: secaoVal,
        }
      }
    })

    const rows: ProcessedRow[] = Object.entries(aggregated).map(([code, item], idx) => {
      const matched = produtos.find((p) => p.ativo && p.codigo && p.codigo.trim() === code)
      const pesoKg = item.pesoTotal

      if (!matched) {
        return {
          id: `row-${idx}`,
          rawCode: item.rawCode,
          pesoKg,
          nomeFromSheet: item.nome || item.rawCode,
          marca: item.marca,
          secao: item.secao,
          matchStatus: pesoKg <= 0 ? ('peso_invalido' as const) : ('auto_cadastrar' as const),
          weightWarning: false,
          caixas: 0,
          pecas: 0,
          textoFormatado: pesoKg > 0 ? `${pesoKg.toFixed(1)} kg` : 'Peso inválido',
        }
      }

      const baseRow: ProcessedRow = {
        id: `row-${idx}`,
        rawCode: item.rawCode,
        pesoKg,
        marca: item.marca,
        secao: item.secao,
        matchStatus: 'ok' as const,
        weightWarning: false,
        caixas: 0,
        pecas: 0,
        textoFormatado: '',
      }
      return applyConversion(baseRow, matched, pesoKg)
    })

    setProcessedRows(rows)
    setWeightAcknowledged(false)
    setStep(3)
  }

  const setRowProduto = (rowId: string, produto: Produto) => {
    setProcessedRows((prev) =>
      prev.map((row) => (row.id === rowId ? applyConversion(row, produto, row.pesoKg) : row)),
    )
  }

  const updateRowProduto = (rowId: string, produtoId: string) => {
    const prod = produtos.find((p) => p.id === produtoId)
    if (!prod) return
    setRowProduto(rowId, prod)
  }

  const updateRowWeight = (rowId: string, newWeight: number) => {
    setProcessedRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row
        if (!row.matchedProduto) {
          return {
            ...row,
            pesoKg: newWeight,
            matchStatus: newWeight <= 0 ? ('peso_invalido' as const) : ('auto_cadastrar' as const),
            textoFormatado: newWeight > 0 ? `${newWeight.toFixed(1)} kg` : 'Peso inválido',
          }
        }
        return applyConversion(row, row.matchedProduto, newWeight)
      }),
    )
    setWeightAcknowledged(false)
  }

  const removeRow = (rowId: string) => {
    setProcessedRows((prev) => prev.filter((row) => row.id !== rowId))
  }

  const removeBlockedRows = () => {
    setProcessedRows((prev) => prev.filter((row) => row.matchStatus !== 'peso_invalido'))
  }

  const handleConfirmImport = async () => {
    if (blockedRows.length > 0) {
      toast({
        title: 'Itens com peso inválido',
        description: 'Corrija ou remova os itens com peso inválido antes de importar.',
        variant: 'destructive',
      })
      return
    }
    if (weightWarningRows.length > 0 && !weightAcknowledged) {
      toast({
        title: 'Confirmação necessária',
        description: 'Marque a caixa confirmando que os pesos estão corretos.',
        variant: 'destructive',
      })
      return
    }

    const valid = processedRows.filter((r) => r.matchStatus === 'ok' && r.matchedProduto)
    const toAutoCreate = processedRows.filter((r) => r.matchStatus === 'auto_cadastrar')
    if (valid.length === 0 && toAutoCreate.length === 0) {
      toast({
        title: 'Nenhum item válido',
        description: 'Associe ao menos um produto antes de confirmar.',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      if (substituir) await deleteItensByRomaneio(romaneioId)
      let totalCaixas = 0
      let totalPecas = 0
      let totalImported = 0

      for (const row of valid) {
        if (!row.matchedProduto) continue
        const updates: Record<string, string> = {}
        if (row.marca && row.matchedProduto.marca !== row.marca) {
          updates.marca = row.marca
        }
        if (row.secao && row.matchedProduto.secao !== row.secao) {
          updates.secao = row.secao
        }
        if (Object.keys(updates).length > 0) {
          await updateProduto(row.matchedProduto.id, updates).catch(() => {})
        }
        await createRomaneioItem({
          romaneio: romaneioId,
          produto: row.matchedProduto.id,
          peso_total_kg: row.pesoKg,
          caixas: row.caixas,
          pecas: row.pecas,
        })
        totalCaixas += row.caixas
        totalPecas += row.pecas
        totalImported++
      }

      for (const row of toAutoCreate) {
        const novoProduto = await createProduto({
          codigo: row.rawCode,
          nome: row.nomeFromSheet || row.rawCode,
          marca: row.marca || '',
          secao: row.secao || undefined,
          ativo: true,
        })
        await createRomaneioItem({
          romaneio: romaneioId,
          produto: novoProduto.id,
          peso_total_kg: row.pesoKg,
          caixas: 0,
          pecas: 0,
        })
        totalImported++
      }

      if (file) await updateRomaneio(romaneioId, { arquivo_planilha: file }).catch(() => {})
      toast({
        title: 'Importação concluída!',
        description: `${totalImported} produtos importados (${totalCaixas} cx • ${totalPecas} pct • ${toAutoCreate.length} auto-cadastrados).`,
      })
      onImportComplete()
      onOpenChange(false)
      resetWizard()
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

  const canConfirm =
    blockedRows.length === 0 &&
    (weightWarningRows.length === 0 || weightAcknowledged) &&
    (validRows.length > 0 || autoCadastrarRows.length > 0)

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v) resetWizard()
          onOpenChange(v)
        }}
      >
        <DialogContent className="sm:max-w-[760px] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-orange-500" />
              Importar Planilha Excel de Carregamento
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-4 gap-2 text-center text-xs font-semibold py-2 border-b">
            {['1. Arquivo', '2. Colunas', '3. Revisão', '4. Resumo'].map((lbl, idx) => {
              const current = idx + 1
              return (
                <div
                  key={lbl}
                  className={cn(
                    'py-1.5 rounded-md',
                    step === current
                      ? 'bg-orange-500 text-white'
                      : step > current
                        ? 'bg-orange-100 text-orange-700'
                        : 'bg-slate-100 text-slate-400',
                  )}
                >
                  {lbl}
                </div>
              )
            })}
          </div>

          <div className="flex-1 overflow-y-auto py-3 space-y-4">
            {step === 1 && (
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center flex flex-col items-center justify-center gap-3 bg-slate-50">
                <Upload className="w-10 h-10 text-orange-500 animate-bounce" />
                <div>
                  <p className="font-semibold text-slate-700">
                    Selecione sua planilha de carregamento
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Formatos aceitos: .xlsx, .xls, .csv (até 5MB)
                  </p>
                </div>
                <label className="cursor-pointer">
                  <Input
                    type="file"
                    accept=".xlsx,.xls,.csv,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button type="button" variant="outline" className="mt-2 pointer-events-none">
                    Escolher Arquivo
                  </Button>
                </label>
              </div>
            )}

            {step === 2 && parsedData && (
              <div className="space-y-4">
                <p className="text-sm text-slate-600">
                  Mapeie as colunas da sua planilha correspondentes ao{' '}
                  <strong>Código do Produto</strong> e <strong>Peso Total (kg)</strong>:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <Label>Coluna do Código</Label>
                    <Select value={colProduto} onValueChange={setColProduto}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {parsedData.headers.map((h) => (
                          <SelectItem key={h} value={h}>
                            {h}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Coluna da Descrição</Label>
                    <Select value={colNome} onValueChange={setColNome}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {parsedData.headers.map((h) => (
                          <SelectItem key={h} value={h}>
                            {h}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Coluna da Marca</Label>
                    <Select value={colMarca} onValueChange={setColMarca}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {parsedData.headers.map((h) => (
                          <SelectItem key={h} value={h}>
                            {h}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Coluna da Seção</Label>
                    <Select value={colSecao} onValueChange={setColSecao}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {parsedData.headers.map((h) => (
                          <SelectItem key={h} value={h}>
                            {h}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Coluna do Peso (kg)</Label>
                    <Select value={colPeso} onValueChange={setColPeso}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {parsedData.headers.map((h) => (
                          <SelectItem key={h} value={h}>
                            {h}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="border rounded-lg p-3 bg-slate-50">
                  <p className="text-xs font-semibold text-slate-500 mb-2">
                    Pré-visualização (Código | Descrição | Marca | Seção | Peso):
                  </p>
                  <div className="space-y-1 text-xs">
                    {parsedData.rows.slice(0, 3).map((r, i) => (
                      <div
                        key={i}
                        className="flex justify-between gap-2 py-1 border-b border-slate-200 last:border-0"
                      >
                        <span className="font-medium text-slate-700">{r[colProduto] || '-'}</span>
                        <span className="text-slate-500 flex-1 text-center">
                          {colNome ? r[colNome] || '-' : '-'}
                        </span>
                        <span className="text-slate-500 flex-1 text-center">
                          {colMarca ? r[colMarca] || '-' : '-'}
                        </span>
                        <span className="text-slate-500 flex-1 text-center">
                          {colSecao ? r[colSecao] || '-' : '-'}
                        </span>
                        <span className="text-slate-500">{r[colPeso] || '-'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">
                  Verifique a conversão automática em caixas e peças. Produtos não cadastrados serão
                  pré-cadastrados automaticamente e pesos suspeitos são destacados:
                </p>
                <div className="border rounded-lg overflow-hidden max-h-[320px] overflow-y-auto">
                  <Table className="text-xs">
                    <TableHeader className="bg-slate-100 sticky top-0">
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Peso (kg)</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead>Marca</TableHead>
                        <TableHead>Resultado</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-8"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {processedRows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-bold text-slate-800">{row.rawCode}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.1"
                              value={row.pesoKg || ''}
                              onChange={(e) =>
                                updateRowWeight(
                                  row.id,
                                  e.target.value === '' ? 0 : Number(e.target.value),
                                )
                              }
                              className="h-7 text-xs w-20"
                            />
                          </TableCell>
                          <TableCell>
                            {row.matchedProduto ? (
                              <span className="text-slate-800 font-semibold">
                                {row.matchedProduto.nome}
                              </span>
                            ) : (
                              <span className="text-blue-600 font-semibold">
                                {row.nomeFromSheet || row.rawCode}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-slate-600 text-xs">
                            {row.marca || '-'}
                          </TableCell>
                          <TableCell className="font-bold text-orange-600">
                            {row.textoFormatado}
                          </TableCell>
                          <TableCell>
                            {row.matchStatus === 'ok' && !row.weightWarning && (
                              <Badge className="bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 border-emerald-500/30">
                                <CheckCircle2 className="w-3 h-3 mr-1" /> OK
                              </Badge>
                            )}
                            {row.matchStatus === 'ok' && row.weightWarning && (
                              <Badge
                                variant="outline"
                                className="text-amber-600 border-amber-400 bg-amber-50"
                                title={row.weightWarningMessage}
                              >
                                <AlertTriangle className="w-3 h-3 mr-1" /> Peso
                              </Badge>
                            )}
                            {row.matchStatus === 'auto_cadastrar' && (
                              <Badge
                                variant="outline"
                                className="text-blue-600 border-blue-400 bg-blue-50"
                              >
                                <Plus className="w-3 h-3 mr-1" /> Auto-cadastrar
                              </Badge>
                            )}
                            {row.matchStatus === 'peso_invalido' && (
                              <Badge variant="destructive">
                                <AlertTriangle className="w-3 h-3 mr-1" /> Peso Inválido
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-slate-300 hover:text-red-500"
                              onClick={() => removeRow(row.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {(autoCadastrarRows.length > 0 ||
                  blockedRows.length > 0 ||
                  weightWarningRows.length > 0) && (
                  <div className="flex gap-3 text-xs">
                    {autoCadastrarRows.length > 0 && (
                      <span className="text-blue-600 font-medium flex items-center gap-1">
                        <Plus className="w-3.5 h-3.5" /> {autoCadastrarRows.length} produto(s) serão
                        auto-cadastrados
                      </span>
                    )}
                    {blockedRows.length > 0 && (
                      <span className="text-red-600 font-medium flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" /> {blockedRows.length} item(ns) com
                        peso inválido
                      </span>
                    )}
                    {weightWarningRows.length > 0 && (
                      <span className="text-amber-600 font-medium flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> {weightWarningRows.length}{' '}
                        aviso(s) de peso
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4 py-2">
                {autoCadastrarRows.length > 0 && (
                  <div className="border border-blue-300 rounded-xl p-4 bg-blue-50 space-y-2">
                    <div className="flex items-center gap-2 text-blue-700 font-semibold text-sm">
                      <Plus className="w-4 h-4" />
                      Produtos que serão pré-cadastrados ({autoCadastrarRows.length}):
                    </div>
                    <div className="space-y-1 max-h-[120px] overflow-y-auto">
                      {autoCadastrarRows.map((row) => (
                        <div
                          key={row.id}
                          className="text-xs text-blue-800 flex justify-between gap-2"
                        >
                          <span className="font-medium">
                            {row.rawCode} — {row.nomeFromSheet || 'Sem descrição'}
                          </span>
                          <span className="text-blue-600">{row.marca || 'Sem marca'}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-blue-600">
                      Estes produtos serão criados automaticamente sem dados de peso (produto de
                      peso variável) e vinculados ao romaneio.
                    </p>
                  </div>
                )}

                {blockedRows.length > 0 && (
                  <div className="border border-red-300 rounded-xl p-4 bg-red-50 space-y-2">
                    <div className="flex items-center gap-2 text-red-700 font-semibold text-sm">
                      <AlertCircle className="w-4 h-4" />
                      Itens com peso inválido ({blockedRows.length}):
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {blockedRows.map((row) => (
                        <Badge key={row.id} variant="destructive" className="text-xs">
                          {row.rawCode}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs text-red-600">
                      Estes itens têm peso zero ou inválido. Corrija o peso ou remova as linhas
                      antes de importar.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={removeBlockedRows}
                      className="text-red-600 border-red-300 hover:bg-red-100"
                    >
                      <Trash2 className="w-3 h-3 mr-1" /> Remover itens com peso inválido
                    </Button>
                  </div>
                )}

                {weightWarningRows.length > 0 && (
                  <div className="border border-amber-300 rounded-xl p-4 bg-amber-50 space-y-2">
                    <div className="flex items-center gap-2 text-amber-700 font-semibold text-sm">
                      <AlertTriangle className="w-4 h-4" />
                      Pesos potencialmente incorretos ({weightWarningRows.length}):
                    </div>
                    <div className="space-y-1 max-h-[120px] overflow-y-auto">
                      {weightWarningRows.map((row) => (
                        <div
                          key={row.id}
                          className="text-xs text-amber-800 flex justify-between gap-2"
                        >
                          <span className="font-medium">
                            Código {row.rawCode}: {row.pesoKg.toFixed(1)} kg
                          </span>
                          <span className="text-amber-600">{row.weightWarningMessage}</span>
                        </div>
                      ))}
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer pt-1">
                      <Checkbox
                        checked={weightAcknowledged}
                        onCheckedChange={(v) => setWeightAcknowledged(!!v)}
                      />
                      <span className="text-xs text-amber-800">
                        Confirmo que revisei os pesos e estão corretos
                      </span>
                    </label>
                  </div>
                )}

                <div className="text-center py-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                  <h3 className="text-lg font-bold text-slate-800 mt-2">Pronto para importar!</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    {validRows.length + autoCadastrarRows.length} itens serão adicionados ao
                    romaneio.
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Total: {validRows.reduce((a, b) => a + b.caixas, 0)} caixas •{' '}
                    {validRows.reduce((a, b) => a + b.pecas, 0)} peças • {autoCadastrarRows.length}{' '}
                    produto(s) de peso variável
                  </p>
                </div>

                {existingItens.length > 0 && (
                  <div className="border rounded-xl p-4 bg-amber-50 text-left space-y-2 text-xs text-amber-800">
                    <p className="font-semibold">
                      Este romaneio já possui {existingItens.length} itens cadastrados.
                    </p>
                    <div className="flex items-center gap-4 pt-1">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="substituir"
                          checked={!substituir}
                          onChange={() => setSubstituir(false)}
                        />
                        <span>Adicionar aos existentes</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer text-red-700 font-medium">
                        <input
                          type="radio"
                          name="substituir"
                          checked={substituir}
                          onChange={() => setSubstituir(true)}
                        />
                        <span>Substituir todos os itens</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="pt-3 border-t">
            {step > 1 && step < 4 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep((s) => (s - 1) as any)}
              >
                Voltar
              </Button>
            )}
            {step === 2 && (
              <Button
                type="button"
                onClick={processSheetRows}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                Processar Colunas <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            )}
            {step === 3 && (
              <Button
                type="button"
                onClick={() => setStep(4)}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                Revisar Resumo
              </Button>
            )}
            {step === 4 && (
              <Button
                type="button"
                onClick={handleConfirmImport}
                disabled={loading || !canConfirm}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {loading ? 'Importando...' : 'Confirmar Importação'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProdutoModal
        open={novoProdutoModal.open}
        onOpenChange={(v: boolean) => setNovoProdutoModal((prev) => ({ ...prev, open: v }))}
        initialName={novoProdutoModal.initialName}
        onSuccess={(prod: Produto) => {
          if (novoProdutoModal.rowId) setRowProduto(novoProdutoModal.rowId, prod)
        }}
      />
    </>
  )
}
