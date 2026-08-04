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
  HelpCircle,
  ArrowRight,
  Plus,
} from 'lucide-react'
import { Produto, RomaneioItem } from '@/types/database'
import { parseExcelOrCsvFile, ParsedSheetData } from '@/lib/excel-parser'
import {
  convertWeightToBoxesAndPieces,
  normalizeProductName,
  parseBrazilianWeight,
} from '@/lib/conversion'
import { createRomaneioItem, deleteItensByRomaneio } from '@/services/romaneio_itens'
import { updateRomaneio } from '@/services/romaneios'
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
  rawName: string
  rawWeight: string
  pesoKg: number
  matchedProduto?: Produto
  matchStatus: 'ok' | 'nao_encontrado' | 'peso_invalido'
  caixas: number
  pecas: number
  textoFormatado: string
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
  const [processedRows, setProcessedRows] = useState<ProcessedRow[]>([])
  const [substituir, setSubstituir] = useState(false)
  const [loading, setLoading] = useState(false)
  const [novoProdutoModal, setNovoProdutoModal] = useState<{
    open: boolean
    initialName: string
    rowId?: string
  }>({
    open: false,
    initialName: '',
  })

  const resetWizard = () => {
    setStep(1)
    setFile(null)
    setParsedData(null)
    setColProduto('')
    setColPeso('')
    setProcessedRows([])
    setSubstituir(false)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0]
    if (!uploadedFile) return
    setFile(uploadedFile)
    setLoading(true)
    try {
      const data = await parseExcelOrCsvFile(uploadedFile)
      setParsedData(data)
      if (data.headers.length >= 2) {
        setColProduto(data.headers[0])
        setColPeso(data.headers[1])
      }
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

  const processSheetRows = () => {
    if (!parsedData || !colProduto || !colPeso) return

    const aggregated: Record<string, { rawName: string; pesoTotal: number }> = {}

    parsedData.rows.forEach((row) => {
      const name = (row[colProduto] || '').trim()
      const weightRaw = row[colPeso] || ''
      if (!name) return

      const weight = parseBrazilianWeight(weightRaw)
      const normKey = normalizeProductName(name)

      if (aggregated[normKey]) {
        aggregated[normKey].pesoTotal += weight
      } else {
        aggregated[normKey] = { rawName: name, pesoTotal: weight }
      }
    })

    const rows: ProcessedRow[] = Object.entries(aggregated).map(([normKey, item], idx) => {
      const matched = produtos.find((p) => p.ativo && normalizeProductName(p.nome) === normKey)
      const pesoKg = item.pesoTotal

      if (pesoKg <= 0) {
        return {
          id: `row-${idx}`,
          rawName: item.rawName,
          rawWeight: item.pesoTotal.toString(),
          pesoKg: 0,
          matchStatus: 'peso_invalido',
          caixas: 0,
          pecas: 0,
          textoFormatado: '0 cx',
        }
      }

      if (!matched) {
        return {
          id: `row-${idx}`,
          rawName: item.rawName,
          rawWeight: item.pesoTotal.toString(),
          pesoKg,
          matchStatus: 'nao_encontrado',
          caixas: 0,
          pecas: 0,
          textoFormatado: 'Sem produto',
        }
      }

      const conv = convertWeightToBoxesAndPieces(
        pesoKg,
        matched.peso_caixa_kg,
        matched.peso_peca_kg,
      )
      return {
        id: `row-${idx}`,
        rawName: item.rawName,
        rawWeight: item.pesoTotal.toString(),
        pesoKg,
        matchedProduto: matched,
        matchStatus: 'ok',
        caixas: conv.caixas,
        pecas: conv.pecas,
        textoFormatado: conv.textoFormatado,
      }
    })

    setProcessedRows(rows)
    setStep(3)
  }

  const updateRowProduto = (rowId: string, produtoId: string) => {
    const prod = produtos.find((p) => p.id === produtoId)
    if (!prod) return

    setProcessedRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row
        const conv = convertWeightToBoxesAndPieces(
          row.pesoKg,
          prod.peso_caixa_kg,
          prod.peso_peca_kg,
        )
        return {
          ...row,
          matchedProduto: prod,
          matchStatus: 'ok',
          caixas: conv.caixas,
          pecas: conv.pecas,
          textoFormatado: conv.textoFormatado,
        }
      }),
    )
  }

  const handleConfirmImport = async () => {
    const validRows = processedRows.filter((r) => r.matchStatus === 'ok' && r.matchedProduto)
    if (validRows.length === 0) {
      toast({
        title: 'Nenhum item válido',
        description: 'Associe ao menos um produto antes de confirmar.',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      if (substituir) {
        await deleteItensByRomaneio(romaneioId)
      }

      let totalCaixas = 0
      let totalPecas = 0

      for (const row of validRows) {
        if (!row.matchedProduto) continue
        await createRomaneioItem({
          romaneio: romaneioId,
          produto: row.matchedProduto.id,
          peso_total_kg: row.pesoKg,
          caixas: row.caixas,
          pecas: row.pecas,
        })
        totalCaixas += row.caixas
        totalPecas += row.pecas
      }

      if (file) {
        await updateRomaneio(romaneioId, { arquivo_planilha: file }).catch(() => {})
      }

      toast({
        title: 'Importação concluída!',
        description: `${validRows.length} produtos importados (${totalCaixas} cx • ${totalPecas} pct).`,
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

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v) resetWizard()
          onOpenChange(v)
        }}
      >
        <DialogContent className="sm:max-w-[720px] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-orange-500" />
              Importar Planilha Excel de Carregamento
            </DialogTitle>
          </DialogHeader>

          {/* Stepper Header */}
          <div className="grid grid-cols-4 gap-2 text-center text-xs font-semibold py-2 border-b">
            {['1. Arquivo', '2. Colunas', '3. Revisão', '4. Confirmar'].map((lbl, idx) => {
              const current = idx + 1
              return (
                <div
                  key={lbl}
                  className={`py-1.5 rounded-md ${
                    step === current
                      ? 'bg-orange-500 text-white'
                      : step > current
                        ? 'bg-orange-100 text-orange-700'
                        : 'bg-slate-100 text-slate-400'
                  }`}
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
                  Mapeie as colunas da sua planilha correspondentes ao **Nome do Produto** e **Peso
                  Total (kg)**:
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Coluna do Produto</Label>
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
                    Pré-visualização das 3 primeiras linhas:
                  </p>
                  <div className="space-y-1 text-xs">
                    {parsedData.rows.slice(0, 3).map((r, i) => (
                      <div
                        key={i}
                        className="flex justify-between py-1 border-b border-slate-200 last:border-0"
                      >
                        <span className="font-medium text-slate-700">{r[colProduto] || '-'}</span>
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
                  Verifique a conversão automática em caixas e peças. Você pode vincular produtos
                  não encontrados:
                </p>
                <div className="border rounded-lg overflow-hidden max-h-[300px] overflow-y-auto">
                  <Table className="text-xs">
                    <TableHeader className="bg-slate-100 sticky top-0">
                      <TableRow>
                        <TableHead>Item Planilha</TableHead>
                        <TableHead>Peso (kg)</TableHead>
                        <TableHead>Produto Mapeado</TableHead>
                        <TableHead>Resultado</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {processedRows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium">{row.rawName}</TableCell>
                          <TableCell>{row.pesoKg.toFixed(1)} kg</TableCell>
                          <TableCell>
                            {row.matchedProduto ? (
                              <span className="text-slate-800 font-semibold">
                                {row.matchedProduto.nome}
                              </span>
                            ) : (
                              <div className="flex items-center gap-1">
                                <Select
                                  value=""
                                  onValueChange={(val) => updateRowProduto(row.id, val)}
                                >
                                  <SelectTrigger className="h-7 text-xs w-[140px]">
                                    <SelectValue placeholder="Vincular..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {produtos
                                      .filter((p) => p.ativo)
                                      .map((p) => (
                                        <SelectItem key={p.id} value={p.id}>
                                          {p.nome} ({p.peso_caixa_kg}kg)
                                        </SelectItem>
                                      ))}
                                  </SelectContent>
                                </Select>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-orange-500"
                                  onClick={() =>
                                    setNovoProdutoModal({
                                      open: true,
                                      initialName: row.rawName,
                                      rowId: row.id,
                                    })
                                  }
                                >
                                  <Plus className="w-4 h-4" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-bold text-orange-600">
                            {row.textoFormatado}
                          </TableCell>
                          <TableCell>
                            {row.matchStatus === 'ok' && (
                              <Badge className="bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 border-emerald-500/30">
                                <CheckCircle2 className="w-3 h-3 mr-1" /> OK
                              </Badge>
                            )}
                            {row.matchStatus === 'nao_encontrado' && (
                              <Badge
                                variant="outline"
                                className="text-amber-600 border-amber-400 bg-amber-50"
                              >
                                <HelpCircle className="w-3 h-3 mr-1" /> Não Achado
                              </Badge>
                            )}
                            {row.matchStatus === 'peso_invalido' && (
                              <Badge variant="destructive">
                                <AlertTriangle className="w-3 h-3 mr-1" /> Peso Inválido
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4 text-center py-4">
                <CheckCircle2 className="w-12 h-10 text-emerald-500 mx-auto" />
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Pronto para importar!</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    {processedRows.filter((r) => r.matchStatus === 'ok').length} itens válidos serão
                    adicionados ao romaneio.
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
                Avançar para Confirmação
              </Button>
            )}
            {step === 4 && (
              <Button
                type="button"
                onClick={handleConfirmImport}
                disabled={loading}
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
        onOpenChange={(v) => setNovoProdutoModal((prev) => ({ ...prev, open: v }))}
        initialName={novoProdutoModal.initialName}
        onSuccess={(prod) => {
          if (novoProdutoModal.rowId) {
            updateRowProduto(novoProdutoModal.rowId, prod.id)
          }
        }}
      />
    </>
  )
}
