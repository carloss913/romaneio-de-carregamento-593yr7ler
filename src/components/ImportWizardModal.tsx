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
import { Progress } from '@/components/ui/progress'
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
  Loader2,
  Edit2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Produto, RomaneioItem, normalizeSecao } from '@/types/database'
import { parseExcelOrCsvFile, ParsedSheetData } from '@/lib/excel-parser'
import {
  convertWeightToBoxesAndPieces,
  convertUnitsToBoxesAndPieces,
  convertPackagesToBoxesAndPieces,
  formatProductAmount,
  isUnidadeProduto,
  isPacoteProduto,
  isNonKgProduto,
  parseBrazilianWeight,
  formatWeight,
} from '@/lib/conversion'
import { createRomaneioItem, updateRomaneioItem } from '@/services/romaneio_itens'
import { updateRomaneio } from '@/services/romaneios'
import { updateProduto, createProduto, getProdutos } from '@/services/produtos'
import { ProdutoModal, InitialProdutoData } from './ProdutoModal'
import { useToast } from '@/hooks/use-toast'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { ClientResponseError } from 'pocketbase'

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
  weightInputStr?: string
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
  isManuallyFixed?: boolean
}

// Mapeamento de colunas (índices 0-based) conforme a quantidade de páginas da exportação.
// 1 página: Código=Col1, Descrição=Col4, Marca=Col12, Seção=Col16, Peso=Col18
// 2 páginas: Código=Col1, Descrição=Col4, Marca=Col11, Seção=Col16, Peso=Col17
// 3 páginas: Código=Col1, Descrição=Col4, Marca=Col11, Seção=Col15, Peso=Col17
const PAGE_COLUMN_MAP: Record<
  '1' | '2' | '3',
  { codigo: number; descricao: number; marca: number; secao: number; peso: number }
> = {
  '1': { codigo: 0, descricao: 3, marca: 11, secao: 15, peso: 17 },
  '2': { codigo: 0, descricao: 3, marca: 10, secao: 15, peso: 16 },
  '3': { codigo: 0, descricao: 3, marca: 10, secao: 14, peso: 16 },
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
  const [numPaginas, setNumPaginas] = useState<'1' | '2' | '3'>('2')
  const [processedRows, setProcessedRows] = useState<ProcessedRow[]>([])
  const [loading, setLoading] = useState(false)
  const [importProgress, setImportProgress] = useState<{
    current: number
    total: number
    message: string
  } | null>(null)
  const [weightAcknowledged, setWeightAcknowledged] = useState(false)
  const [produtoModalState, setProdutoModalState] = useState<{
    open: boolean
    produto?: Produto | null
    initialData?: InitialProdutoData | null
    rowId?: string
    rawCode?: string
  }>({ open: false })

  const blockedRows = processedRows.filter((r) => r.matchStatus === 'peso_invalido')
  const autoCadastrarRows = processedRows.filter((r) => r.matchStatus === 'auto_cadastrar')
  const weightWarningRows = processedRows.filter((r) => r.matchStatus === 'ok' && r.weightWarning)
  const validRows = processedRows.filter((r) => r.matchStatus === 'ok')

  const applyPageCount = (n: '1' | '2' | '3', headers: string[]) => {
    const m = PAGE_COLUMN_MAP[n]
    setColProduto(headers[m.codigo] || '')
    setColNome(headers[m.descricao] || '')
    setColMarca(headers[m.marca] || '')
    setColSecao(headers[m.secao] || '')
    setColPeso(headers[m.peso] || '')
  }

  const resetWizard = () => {
    setStep(1)
    setFile(null)
    setParsedData(null)
    setColProduto('')
    setColPeso('')
    setColMarca('')
    setColNome('')
    setColSecao('')
    setNumPaginas('2')
    setProcessedRows([])
    setWeightAcknowledged(false)
    setImportProgress(null)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0]
    if (!uploadedFile) return
    setFile(uploadedFile)
    setLoading(true)
    try {
      const data = await parseExcelOrCsvFile(uploadedFile)
      setParsedData(data)
      setNumPaginas('2')
      applyPageCount('2', data.headers)
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
    const isPct = isPacoteProduto(produto.unidade_medida)
    const isUn = isUnidadeProduto(produto.unidade_medida)

    if (isPct) {
      const conv = convertPackagesToBoxesAndPieces(pesoKg, produto.pecas_por_caixa)
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

    if (isUn) {
      const conv = convertUnitsToBoxesAndPieces(pesoKg, produto.pecas_por_caixa)
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

    if (!produto.peso_caixa_kg || produto.peso_caixa_kg <= 0) {
      return {
        ...row,
        matchedProduto: produto,
        matchStatus: pesoKg <= 0 ? 'peso_invalido' : 'ok',
        weightWarning: false,
        caixas: 0,
        pecas: 0,
        textoFormatado: `${formatWeight(pesoKg)} kg`,
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

  const processSheetRows = async () => {
    if (!parsedData || !colProduto || !colPeso) return
    setLoading(true)
    let produtosAtuais = produtos
    try {
      produtosAtuais = await getProdutos()
    } catch (err) {
      toast({
        title: 'Erro ao buscar produtos',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
      setLoading(false)
      return
    }

    try {
      const aggregated: Record<
        string,
        {
          rawCode: string
          pesoTotal: number
          marca: string
          nome: string
          secao: string
          occurrences: number
        }
      > = {}

      parsedData.rows.forEach((row) => {
        const rawCodeVal = (row[colProduto] || '').trim()
        const weightRaw = row[colPeso] || ''
        if (!rawCodeVal) return
        const weight = parseBrazilianWeight(weightRaw)
        const marcaVal = colMarca ? (row[colMarca] || '').trim() : ''
        const nomeVal = colNome ? (row[colNome] || '').trim() : ''
        const rawSecao = colSecao ? (row[colSecao] || '').trim() : ''
        const secaoVal = normalizeSecao(rawSecao) || rawSecao

        // Normalização da chave: produtos do tipo "00123" e "123" ou com espaços não devem se duplicar na planilha
        const key = rawCodeVal

        if (aggregated[key]) {
          // Soma com arredondamento preciso para 3 casas decimais
          aggregated[key].pesoTotal = Math.round((aggregated[key].pesoTotal + weight) * 1000) / 1000
          aggregated[key].occurrences += 1
          if (marcaVal && !aggregated[key].marca) {
            aggregated[key].marca = marcaVal
          }
          if (nomeVal && !aggregated[key].nome) {
            aggregated[key].nome = nomeVal
          }
          if (secaoVal && (!aggregated[key].secao || !normalizeSecao(aggregated[key].secao))) {
            aggregated[key].secao = secaoVal
          }
        } else {
          aggregated[key] = {
            rawCode: rawCodeVal,
            pesoTotal: weight,
            marca: marcaVal,
            nome: nomeVal,
            secao: secaoVal,
            occurrences: 1,
          }
        }
      })

      const rows: ProcessedRow[] = Object.entries(aggregated).map(([code, item], idx) => {
        const matched = produtosAtuais.find((p) => p.ativo && p.codigo && p.codigo.trim() === code)
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
            textoFormatado: pesoKg > 0 ? `${formatWeight(pesoKg)} kg` : 'Peso inválido',
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
    } finally {
      setLoading(false)
    }
  }

  const setRowProduto = (rowId: string, produto: Produto) => {
    setProcessedRows((prev) => {
      const targetRow = prev.find((r) => r.id === rowId)
      const targetCode = (targetRow?.rawCode || produto.codigo || '').trim()

      return prev.map((row) => {
        // Se a linha tiver o mesmo rowId OU o mesmo código do produto
        if (row.id === rowId || (targetCode && row.rawCode.trim() === targetCode)) {
          const updated = applyConversion(
            {
              ...row,
              nomeFromSheet: produto.nome,
              marca: produto.marca || row.marca,
              secao: produto.secao || row.secao,
            },
            produto,
            row.pesoKg,
          )
          return {
            ...updated,
            weightInputStr: row.weightInputStr,
            isManuallyFixed: row.isManuallyFixed,
          }
        }
        return row
      })
    })
  }

  const handleOpenEditModal = (row: ProcessedRow) => {
    if (row.matchedProduto) {
      setProdutoModalState({
        open: true,
        produto: row.matchedProduto,
        initialData: null,
        rowId: row.id,
        rawCode: row.rawCode,
      })
    } else {
      setProdutoModalState({
        open: true,
        produto: null,
        initialData: {
          codigo: row.rawCode,
          nome: row.nomeFromSheet || row.rawCode,
          marca: row.marca || '',
          secao: row.secao || '',
          unidade_medida: 'kg',
        },
        rowId: row.id,
        rawCode: row.rawCode,
      })
    }
  }

  const handleWeightInputChange = (rowId: string, rawInput: string) => {
    setProcessedRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row

        const trimmed = rawInput.trim()
        const parsed = parseBrazilianWeight(rawInput)
        const hasValidNumber = trimmed !== '' && !isNaN(parsed) && parsed > 0

        if (!hasValidNumber) {
          // Campo vazio, zero ou string inválida enquanto digita
          return {
            ...row,
            pesoKg: 0,
            weightInputStr: rawInput,
            matchStatus: 'peso_invalido' as const,
            weightWarning: true,
            weightWarningMessage: 'Peso em branco ou inválido.',
            caixas: 0,
            pecas: 0,
            textoFormatado: '0 cx',
            isManuallyFixed: true,
          }
        }

        const newWeight = parsed
        if (!row.matchedProduto) {
          return {
            ...row,
            pesoKg: newWeight,
            weightInputStr: rawInput,
            matchStatus: 'auto_cadastrar' as const,
            weightWarning: false,
            textoFormatado: `${formatWeight(newWeight)} kg`,
            isManuallyFixed: true,
          }
        }

        const updated = applyConversion(row, row.matchedProduto, newWeight)
        return {
          ...updated,
          weightInputStr: rawInput,
          isManuallyFixed: true,
        }
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

  // Executa uma operação com retry individual e backoff adaptativo progressivo
  const executeWithRetry = async <T,>(operation: () => Promise<T>, maxRetries = 6): Promise<T> => {
    let attempt = 0
    while (attempt < maxRetries) {
      try {
        return await operation()
      } catch (err: unknown) {
        attempt++
        const is429 =
          (err instanceof ClientResponseError && err.status === 429) ||
          (typeof err === 'object' &&
            err !== null &&
            'status' in err &&
            (err as any).status === 429)

        if (attempt < maxRetries) {
          // Backoff adaptativo progressivo: se 429 (rate limit), espera 400ms, 800ms, 1500ms, 2500ms, 4000ms com jitter
          const baseDelay = is429 ? Math.min(400 * Math.pow(1.8, attempt - 1), 4000) : 300 * attempt
          const jitter = Math.floor(Math.random() * 120)
          await new Promise((resolve) => setTimeout(resolve, baseDelay + jitter))
          continue
        }
        throw err
      }
    }
    throw new Error('Número máximo de tentativas atingido.')
  }

  // Executa uma lista de tarefas com paralelismo real (concorrência de 3-4 requisições simultâneas)
  // Cada item executa como requisição individual ao PocketBase com seu próprio retry independente.
  // Sem delay artificial/cego entre itens. Em caso de 429 persistente, aplica cooling adaptativo.
  const processInParallel = async <T, R>(
    items: T[],
    concurrency: number,
    task: (item: T) => Promise<R>,
    onItemCompleted?: (completedCount: number, total: number) => void,
  ): Promise<PromiseSettledResult<R>[]> => {
    if (items.length === 0) return []

    const results: PromiseSettledResult<R>[] = new Array(items.length)
    let nextIndex = 0
    let completedCount = 0

    const runWorker = async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex++
        const item = items[currentIndex]

        let had429 = false
        try {
          const res = await task(item)
          results[currentIndex] = { status: 'fulfilled', value: res }
        } catch (err: unknown) {
          const is429 =
            (err instanceof ClientResponseError && err.status === 429) ||
            (typeof err === 'object' &&
              err !== null &&
              'status' in err &&
              (err as any).status === 429)
          if (is429) {
            had429 = true
          }
          results[currentIndex] = { status: 'rejected', reason: err }
        }

        completedCount++
        onItemCompleted?.(completedCount, items.length)

        // Cooling adaptativo caso o servidor ainda responda 429 após retries individuais
        if (had429) {
          await new Promise((resolve) => setTimeout(resolve, 800))
        }
      }
    }

    const workerCount = Math.min(Math.max(concurrency, 1), items.length)
    const workers = Array.from({ length: workerCount }, () => runWorker())
    await Promise.all(workers)

    return results
  }

  // Executa uma lista de operações sequencialmente (sem concorrência entre si)
  // Utilizado para operações de soma no mesmo registro do PocketBase para evitar race conditions
  const processSequentially = async <T, R>(
    items: T[],
    task: (item: T) => Promise<R>,
    onItemCompleted?: (completedCount: number, total: number) => void,
  ): Promise<PromiseSettledResult<R>[]> => {
    if (items.length === 0) return []

    const results: PromiseSettledResult<R>[] = []
    let completedCount = 0

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      try {
        const res = await task(item)
        results.push({ status: 'fulfilled', value: res })
      } catch (err: unknown) {
        results.push({ status: 'rejected', reason: err })
      }
      completedCount++
      onItemCompleted?.(completedCount, items.length)
    }

    return results
  }

  const handleConfirmImport = async () => {
    if (blockedRows.length > 0) {
      toast({
        title: 'Itens com quantidade/peso inválido',
        description:
          'Corrija ou remova os itens com quantidade ou peso inválido antes de importar.',
        variant: 'destructive',
      })
      return
    }
    if (weightWarningRows.length > 0 && !weightAcknowledged) {
      toast({
        title: 'Confirmação necessária',
        description: 'Marque a caixa confirmando que as quantidades e pesos estão corretos.',
        variant: 'destructive',
      })
      return
    }

    const valid = processedRows.filter(
      (r) => r.matchStatus === 'ok' && r.matchedProduto && r.pesoKg > 0,
    )
    const toAutoCreate = processedRows.filter(
      (r) => r.matchStatus === 'auto_cadastrar' && r.pesoKg > 0,
    )
    if (valid.length === 0 && toAutoCreate.length === 0) {
      toast({
        title: 'Nenhum item válido',
        description: 'Associe ao menos um produto e informe um peso válido antes de confirmar.',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    const totalOperations = valid.length + toAutoCreate.length
    setImportProgress({
      current: 0,
      total: totalOperations,
      message: 'Iniciando importação...',
    })

    // Paralelismo real: 3 a 4 requisições simultâneas sem delay cego
    const CONCURRENCY = 4

    try {
      let totalCaixas = 0
      let totalPecas = 0
      let totalImported = 0
      let totalFailures = 0
      const errorsList: string[] = []

      // 1. Processar auto-cadastros de produtos primeiro (em paralelo 3-4 simultâneos)
      const autoCreatedMap = new Map<string, Produto>()
      if (toAutoCreate.length > 0) {
        setImportProgress({
          current: 0,
          total: totalOperations,
          message: `Cadastrando ${toAutoCreate.length} novo(s) produto(s)...`,
        })

        await processInParallel(
          toAutoCreate,
          CONCURRENCY,
          async (row) => {
            try {
              const normSecao = normalizeSecao(row.secao)
              const novoProduto = await executeWithRetry(() =>
                createProduto({
                  codigo: row.rawCode,
                  nome: row.nomeFromSheet || row.rawCode,
                  marca: row.marca || '',
                  secao: normSecao,
                  ativo: true,
                }),
              )
              autoCreatedMap.set(row.id, novoProduto)
              return novoProduto
            } catch (err: unknown) {
              const prodIdentifier = row.rawCode || row.nomeFromSheet || 'Desconhecido'
              const errorReason = getErrorMessage(err)
              console.error(`Erro ao auto-cadastrar produto [${prodIdentifier}]:`, err)
              errorsList.push(`Produto [${prodIdentifier}]: ${errorReason}`)
              toast({
                title: `Falha ao cadastrar produto [${prodIdentifier}]`,
                description: errorReason,
                variant: 'destructive',
              })
              throw err
            }
          },
          (completed) => {
            setImportProgress({
              current: completed,
              total: totalOperations,
              message: `Cadastrando novos produtos (${completed} de ${toAutoCreate.length})...`,
            })
          },
        )
      }

      // 2. Atualizar produtos existentes com novas seções/marcas se necessário (em paralelo)
      const rowsWithUpdates = valid.filter((row) => {
        if (!row.matchedProduto) return false
        const normSecao =
          normalizeSecao(row.secao) ||
          (row.secao && row.secao.trim() ? (row.secao.trim() as any) : undefined)
        const hasMarcaDiff = !!(row.marca && row.matchedProduto.marca !== row.marca)
        const hasSecaoDiff = !!(normSecao && row.matchedProduto.secao !== normSecao)
        return hasMarcaDiff || hasSecaoDiff
      })

      if (rowsWithUpdates.length > 0) {
        setImportProgress({
          current: toAutoCreate.length,
          total: totalOperations,
          message: `Atualizando informações de ${rowsWithUpdates.length} produto(s)...`,
        })

        await processInParallel(rowsWithUpdates, CONCURRENCY, async (row) => {
          if (!row.matchedProduto) return
          const updates: Record<string, string> = {}
          if (row.marca && row.matchedProduto.marca !== row.marca) {
            updates.marca = row.marca
          }
          const normSecao =
            normalizeSecao(row.secao) ||
            (row.secao && row.secao.trim() ? (row.secao.trim() as any) : undefined)
          if (normSecao && row.matchedProduto.secao !== normSecao) {
            updates.secao = normSecao
          }
          if (Object.keys(updates).length > 0) {
            try {
              await executeWithRetry(() => updateProduto(row.matchedProduto!.id, updates))
            } catch (updateErr) {
              console.error('Erro ao atualizar produto:', updateErr)
            }
          }
        })
      }

      // 3. Processar itens do romaneio: somar aos itens existentes se mesmo código de produto ou criar novos
      interface ItemOperation {
        row: ProcessedRow
        produtoId: string
        produtoObj: Produto
        pesoKg: number
        caixas: number
        pecas: number
        observacao?: string
        isUpdate: boolean
        existingItemId?: string
        newTotalPesoKg?: number
        newObsAcrescimo?: string
        targetCode: string
      }

      // Montar mapa dos itens já existentes no romaneio indexados por código do produto (trimmed)
      const existingByCode = new Map<string, RomaneioItem>()
      existingItens.forEach((item) => {
        const prod = item.expand?.produto || produtos.find((p) => p.id === item.produto)
        if (prod?.codigo) {
          const normCode = prod.codigo.trim()
          if (!existingByCode.has(normCode)) {
            existingByCode.set(normCode, item)
          }
        }
      })

      const now = new Date()
      const diaMes = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}`

      // Mapa temporário para rastrear peso cumulativo e observação cumulativa
      // caso múltiplas linhas da planilha façam referência ao mesmo produto existente
      const runningStateMap = new Map<
        string,
        {
          existingItemId: string
          currentTotalPesoKg: number
          currentObsAcrescimo: string
        }
      >()

      const operationsToExecute: ItemOperation[] = []

      for (const row of valid) {
        if (row.matchedProduto) {
          const finalPeso = row.pesoKg
          const needsConferirPeso = row.weightWarning || row.isManuallyFixed
          const rowCode = (row.matchedProduto.codigo || row.rawCode || '').trim()
          const existing = existingByCode.get(rowCode)

          if (existing) {
            // Item repetido! Somar peso cumulativo no mesmo item existente
            let runningState = runningStateMap.get(rowCode)
            if (!runningState) {
              runningState = {
                existingItemId: existing.id,
                currentTotalPesoKg: existing.peso_total_kg || 0,
                currentObsAcrescimo: existing.obs_acrescimo || '',
              }
              runningStateMap.set(rowCode, runningState)
            }

            const somadoPesoKg =
              Math.round((runningState.currentTotalPesoKg + finalPeso) * 1000) / 1000
            const conv = applyConversion(row, row.matchedProduto, somadoPesoKg)

            const formattedAdded = formatWeight(finalPeso)
            const unidadeSufixo = isNonKgProduto(row.matchedProduto.unidade_medida) ? 'un' : 'kg'
            const newNota = `Importação somada: +${formattedAdded} ${unidadeSufixo} (planilha de ${diaMes})`
            const combinedObsAcrescimo =
              runningState.currentObsAcrescimo && runningState.currentObsAcrescimo.trim()
                ? `${runningState.currentObsAcrescimo.trim()} | ${newNota}`
                : newNota

            // Atualiza o runningState para a próxima ocorrência (se houver)
            runningState.currentTotalPesoKg = somadoPesoKg
            runningState.currentObsAcrescimo = combinedObsAcrescimo

            operationsToExecute.push({
              row,
              produtoId: row.matchedProduto.id,
              produtoObj: row.matchedProduto,
              pesoKg: finalPeso,
              caixas: conv.caixas,
              pecas: conv.pecas,
              isUpdate: true,
              existingItemId: existing.id,
              newTotalPesoKg: somadoPesoKg,
              newObsAcrescimo: combinedObsAcrescimo,
              targetCode: rowCode,
            })
          } else {
            operationsToExecute.push({
              row,
              produtoId: row.matchedProduto.id,
              produtoObj: row.matchedProduto,
              pesoKg: finalPeso,
              caixas: row.caixas,
              pecas: row.pecas,
              observacao: needsConferirPeso ? 'conferir peso' : undefined,
              isUpdate: false,
              targetCode: rowCode,
            })
          }
        }
      }

      for (const row of toAutoCreate) {
        const novoProduto = autoCreatedMap.get(row.id)
        if (novoProduto) {
          const finalPeso = row.pesoKg
          const needsConferirPeso = row.weightWarning || row.isManuallyFixed
          operationsToExecute.push({
            row,
            produtoId: novoProduto.id,
            produtoObj: novoProduto,
            pesoKg: finalPeso,
            caixas: 0,
            pecas: 0,
            observacao: needsConferirPeso ? 'conferir peso' : undefined,
            isUpdate: false,
            targetCode: (novoProduto.codigo || row.rawCode || '').trim(),
          })
        } else {
          // Se o produto falhou no auto-cadastro, não tenta criar o item no romaneio
          totalFailures++
        }
      }

      setImportProgress({
        current: toAutoCreate.length,
        total: totalOperations,
        message: `Gravando itens no romaneio (0 de ${operationsToExecute.length})...`,
      })

      // Separar as operações:
      // - updates (somas em itens existentes): agrupadas por targetCode e executadas sequencialmente
      //   para garantir que não haja race condition na soma do mesmo registro.
      // - inserts (novos itens no romaneio): executados em paralelo com CONCURRENCY (3-4 workers simultâneos).
      const updateOperations = operationsToExecute.filter((op) => op.isUpdate)
      const insertOperations = operationsToExecute.filter((op) => !op.isUpdate)

      let completedOperations = 0
      const updateResults: { op: ItemOperation; result: PromiseSettledResult<any> }[] = []
      const insertResults: { op: ItemOperation; result: PromiseSettledResult<any> }[] = []

      // 3a. Executar updates de soma de forma serializada por segurança de concorrência
      if (updateOperations.length > 0) {
        const resList = await processSequentially(
          updateOperations,
          async (op) => {
            return executeWithRetry(() =>
              updateRomaneioItem(op.existingItemId!, {
                peso_total_kg: op.newTotalPesoKg!,
                caixas: op.caixas,
                pecas: op.pecas,
                obs_acrescimo: op.newObsAcrescimo!,
              }),
            )
          },
          () => {
            completedOperations++
            const overallDone = Math.min(toAutoCreate.length + completedOperations, totalOperations)
            setImportProgress({
              current: overallDone,
              total: totalOperations,
              message: `Gravando... ${completedOperations} de ${operationsToExecute.length} gravados`,
            })
          },
        )
        resList.forEach((r, idx) => {
          updateResults.push({ op: updateOperations[idx], result: r })
        })
      }

      // 3b. Executar inserts em paralelo real (concorrência controlada com retry)
      if (insertOperations.length > 0) {
        const resList = await processInParallel(
          insertOperations,
          CONCURRENCY,
          async (op) => {
            return executeWithRetry(() =>
              createRomaneioItem({
                romaneio: romaneioId,
                produto: op.produtoId,
                peso_total_kg: op.pesoKg,
                caixas: op.caixas,
                pecas: op.pecas,
                ...(op.observacao ? { observacao: op.observacao } : {}),
              }),
            )
          },
          () => {
            completedOperations++
            const overallDone = Math.min(toAutoCreate.length + completedOperations, totalOperations)
            setImportProgress({
              current: overallDone,
              total: totalOperations,
              message: `Gravando... ${completedOperations} de ${operationsToExecute.length} gravados`,
            })
          },
        )
        resList.forEach((r, idx) => {
          insertResults.push({ op: insertOperations[idx], result: r })
        })
      }

      // Computar totais de todas as operações executadas
      const allFinishedResults = [...updateResults, ...insertResults]
      allFinishedResults.forEach(({ op, result: res }) => {
        if (res.status === 'fulfilled') {
          totalImported++
          totalCaixas += op.caixas
          totalPecas += op.pecas
        } else {
          totalFailures++
          const prodIdentifier = op.row.rawCode || 'Desconhecido'
          const errorReason = getErrorMessage(res.reason)
          errorsList.push(`Item [${prodIdentifier}]: ${errorReason}`)
          console.error(`Erro ao gravar item do romaneio para [${prodIdentifier}]:`, res.reason)
        }
      })

      if (file) {
        try {
          await executeWithRetry(() => updateRomaneio(romaneioId, { arquivo_planilha: file }))
        } catch (err) {
          console.error('Erro ao salvar planilha no romaneio:', err)
        }
      }

      // Verificação de integridade final: conferir quantos itens foram efetivamente gravados e informar
      const totalEsperado = operationsToExecute.length
      if (totalFailures > 0) {
        const failSummary = errorsList.length > 0 ? ` (${errorsList.slice(0, 3).join('; ')})` : ''
        toast({
          title: totalImported > 0 ? 'Importação parcial concluída' : 'Falha na importação',
          description: `${totalImported} de ${totalEsperado} gravados (${totalFailures} falha(s))${failSummary}.`,
          variant: 'destructive',
        })
      } else {
        toast({
          title: 'Importação concluída com sucesso!',
          description: `${totalImported} de ${totalEsperado} gravados (${totalCaixas} cx • ${totalPecas} pct${toAutoCreate.length > 0 ? ` • ${toAutoCreate.length} novos produtos cadastrados` : ''}).`,
        })
      }

      if (totalImported > 0) {
        onImportComplete()
      }
      if (totalFailures === 0) {
        onOpenChange(false)
        resetWizard()
      }
    } catch (err) {
      toast({
        title: 'Erro na importação',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
      setImportProgress(null)
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
                  Selecione a <strong>quantidade de páginas</strong> da exportação. As colunas serão
                  preenchidas automaticamente, mas podem ser ajustadas manualmente se necessário:
                </p>
                <div className="space-y-1.5 max-w-xs">
                  <Label>Quantidade de páginas</Label>
                  <Select
                    value={numPaginas}
                    onValueChange={(v) => {
                      const n = v as '1' | '2' | '3'
                      setNumPaginas(n)
                      applyPageCount(n, parsedData.headers)
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 página</SelectItem>
                      <SelectItem value="2">2 páginas</SelectItem>
                      <SelectItem value="3">3 páginas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  {[
                    { label: 'Código', value: colProduto, onChange: setColProduto },
                    { label: 'Descrição', value: colNome, onChange: setColNome },
                    { label: 'Marca', value: colMarca, onChange: setColMarca },
                    { label: 'Seção', value: colSecao, onChange: setColSecao },
                    { label: 'Peso (kg)', value: colPeso, onChange: setColPeso },
                  ].map((f) => (
                    <div key={f.label} className="space-y-1.5">
                      <Label>{f.label}</Label>
                      <Select value={f.value} onValueChange={f.onChange}>
                        <SelectTrigger className="bg-slate-50">
                          <SelectValue placeholder="Selecione a coluna" />
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
                  ))}
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
                        <TableHead>Seção</TableHead>
                        <TableHead>Quantidade / Peso</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead>Marca</TableHead>
                        <TableHead>Resultado Conversão</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {processedRows.map((row) => {
                        const detectedSecao = normalizeSecao(row.secao)
                        const hasSecaoText = !!(row.secao && row.secao.trim())

                        return (
                          <TableRow key={row.id}>
                            <TableCell className="font-bold text-slate-800">
                              {row.rawCode}
                            </TableCell>
                            <TableCell>
                              {detectedSecao === 'CONGELADO' && (
                                <Badge
                                  variant="outline"
                                  className="bg-cyan-50 text-cyan-700 border-cyan-300 font-semibold text-[10px] px-1.5 py-0.5"
                                >
                                  CONGELADO
                                </Badge>
                              )}
                              {detectedSecao === 'GERAL' && (
                                <Badge
                                  variant="outline"
                                  className="bg-amber-50 text-amber-700 border-amber-300 font-semibold text-[10px] px-1.5 py-0.5"
                                >
                                  GERAL
                                </Badge>
                              )}
                              {detectedSecao === 'RESFRIADO' && (
                                <Badge
                                  variant="outline"
                                  className="bg-blue-50 text-blue-700 border-blue-300 font-semibold text-[10px] px-1.5 py-0.5"
                                >
                                  RESFRIADO
                                </Badge>
                              )}
                              {!detectedSecao && hasSecaoText && (
                                <Badge
                                  variant="outline"
                                  className="bg-slate-100 text-slate-700 border-slate-300 text-[10px] px-1.5 py-0.5"
                                  title={`Valor bruto: ${row.secao}`}
                                >
                                  {row.secao}
                                </Badge>
                              )}
                              {!hasSecaoText && (
                                <Badge
                                  variant="outline"
                                  className="bg-red-50 text-red-600 border-red-300 font-semibold text-[10px] px-1.5 py-0.5 flex items-center gap-1 w-fit"
                                  title="Sem seção definida na planilha"
                                >
                                  <AlertCircle className="w-3 h-3 text-red-500" />
                                  <span>Sem seção</span>
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {row.weightWarning ||
                              row.matchStatus === 'peso_invalido' ||
                              row.isManuallyFixed ? (
                                <div className="flex items-center gap-1">
                                  <Input
                                    type="text"
                                    inputMode="decimal"
                                    value={
                                      row.weightInputStr !== undefined
                                        ? row.weightInputStr
                                        : row.pesoKg === 0
                                          ? ''
                                          : String(row.pesoKg)
                                    }
                                    onChange={(e) =>
                                      handleWeightInputChange(row.id, e.target.value)
                                    }
                                    className="h-7 text-xs w-24 font-medium border-amber-400 bg-amber-50/60 focus-visible:ring-amber-500"
                                    title={
                                      isPacoteProduto(row.matchedProduto?.unidade_medida)
                                        ? 'Editar quantidade em espetos/unidades'
                                        : isUnidadeProduto(row.matchedProduto?.unidade_medida)
                                          ? 'Editar quantidade em unidades'
                                          : 'Editar peso em kg'
                                    }
                                    placeholder="0"
                                  />
                                  <span className="text-[11px] font-semibold text-slate-500">
                                    {isNonKgProduto(row.matchedProduto?.unidade_medida)
                                      ? 'un'
                                      : 'kg'}
                                  </span>
                                </div>
                              ) : (
                                <span className="font-medium text-slate-700 text-xs px-1">
                                  {formatProductAmount(
                                    row.pesoKg,
                                    row.matchedProduto?.unidade_medida,
                                  )}
                                </span>
                              )}
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
                                  <CheckCircle2 className="w-3 h-3 mr-1" />{' '}
                                  {isPacoteProduto(row.matchedProduto?.unidade_medida)
                                    ? 'Pacote OK'
                                    : isUnidadeProduto(row.matchedProduto?.unidade_medida)
                                      ? 'Unidade OK'
                                      : 'OK'}
                                </Badge>
                              )}
                              {row.matchStatus === 'ok' && row.weightWarning && (
                                <Badge
                                  variant="outline"
                                  className="text-amber-600 border-amber-400 bg-amber-50"
                                  title={row.weightWarningMessage}
                                >
                                  <AlertTriangle className="w-3 h-3 mr-1" />{' '}
                                  {isNonKgProduto(row.matchedProduto?.unidade_medida)
                                    ? 'Conferir Qtd'
                                    : 'Peso'}
                                </Badge>
                              )}
                              {row.matchStatus === 'auto_cadastrar' && (
                                <Badge
                                  variant="outline"
                                  onClick={() => handleOpenEditModal(row)}
                                  className="text-blue-600 border-blue-400 bg-blue-50 hover:bg-blue-100 cursor-pointer"
                                  title="Clique para completar o cadastro deste produto"
                                >
                                  <Plus className="w-3 h-3 mr-1" /> Auto-cadastrar
                                </Badge>
                              )}
                              {row.matchStatus === 'peso_invalido' && (
                                <Badge variant="destructive">
                                  <AlertTriangle className="w-3 h-3 mr-1" /> Qtd/Peso Inválido
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className={cn(
                                    'h-7 w-7',
                                    row.matchStatus === 'auto_cadastrar'
                                      ? 'text-blue-600 hover:bg-blue-50 hover:text-blue-700'
                                      : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100',
                                  )}
                                  title={
                                    row.matchStatus === 'auto_cadastrar'
                                      ? 'Cadastrar informações do produto (peso cx, peças, seção...)'
                                      : 'Editar cadastro do produto'
                                  }
                                  onClick={() => handleOpenEditModal(row)}
                                >
                                  {row.matchStatus === 'auto_cadastrar' ? (
                                    <Plus className="w-3.5 h-3.5" />
                                  ) : (
                                    <Edit2 className="w-3.5 h-3.5" />
                                  )}
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-slate-300 hover:text-red-500 hover:bg-red-50"
                                  onClick={() => removeRow(row.id)}
                                  title="Remover item da importação"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
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
                          className="text-xs text-blue-800 flex items-center justify-between gap-2 p-1 rounded hover:bg-blue-100/60"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="font-mono font-bold bg-blue-200/60 px-1 rounded">
                              {row.rawCode}
                            </span>
                            <span className="truncate">{row.nomeFromSheet || 'Sem descrição'}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-blue-600 text-[11px]">
                              {row.marca || 'Sem marca'}
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenEditModal(row)}
                              className="h-6 px-2 text-[11px] border-blue-300 text-blue-700 bg-white hover:bg-blue-50"
                            >
                              <Edit2 className="w-3 h-3 mr-1" /> Preencher dados
                            </Button>
                          </div>
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
                    <div className="space-y-1 max-h-[140px] overflow-y-auto">
                      {weightWarningRows.map((row) => {
                        const productName =
                          row.matchedProduto?.nome || row.nomeFromSheet || 'Sem descrição'
                        return (
                          <div
                            key={row.id}
                            className="text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 rounded-lg bg-amber-100/60 border border-amber-200"
                          >
                            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 truncate">
                                <span className="font-mono font-bold bg-amber-200/90 text-amber-900 px-1.5 py-0.5 rounded text-[11px] shrink-0">
                                  {row.rawCode}
                                </span>
                                <span
                                  className="font-semibold text-slate-800 truncate"
                                  title={productName}
                                >
                                  {productName}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-[11px] text-amber-800">
                                <span className="font-medium text-orange-700">
                                  {row.textoFormatado}
                                </span>
                                <span>•</span>
                                <span className="truncate text-amber-700 font-normal">
                                  {row.weightWarningMessage}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <Label className="text-[11px] text-amber-900 font-semibold whitespace-nowrap">
                                {isPacoteProduto(row.matchedProduto?.unidade_medida)
                                  ? 'Qtd (espetos):'
                                  : isUnidadeProduto(row.matchedProduto?.unidade_medida)
                                    ? 'Qtd (un):'
                                    : 'Peso (kg):'}
                              </Label>
                              <Input
                                type="text"
                                inputMode="decimal"
                                value={
                                  row.weightInputStr !== undefined
                                    ? row.weightInputStr
                                    : row.pesoKg === 0
                                      ? ''
                                      : String(row.pesoKg)
                                }
                                onChange={(e) => handleWeightInputChange(row.id, e.target.value)}
                                className="h-7 w-24 text-xs font-semibold bg-white border-amber-400 focus-visible:ring-amber-500 shadow-sm"
                                placeholder="0.000"
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer pt-1">
                      <Checkbox
                        checked={weightAcknowledged}
                        onCheckedChange={(v) => setWeightAcknowledged(!!v)}
                      />
                      <span className="text-xs text-amber-800 font-medium">
                        Confirmo que revisei as quantidades/pesos e estão corretos (será gravada a
                        observação "conferir peso")
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

                {loading && importProgress && (
                  <div className="border border-orange-200 rounded-xl p-4 bg-orange-50/80 space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-orange-800">
                      <span className="flex items-center gap-1.5">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-600" />
                        {importProgress.message}
                      </span>
                      <span>
                        {importProgress.current} de {importProgress.total} (
                        {Math.round(
                          (importProgress.current / Math.max(importProgress.total, 1)) * 100,
                        )}
                        %)
                      </span>
                    </div>
                    <Progress
                      value={(importProgress.current / Math.max(importProgress.total, 1)) * 100}
                      className="h-2 bg-orange-100"
                    />
                  </div>
                )}

                {existingItens.length > 0 && (
                  <div className="border rounded-xl p-3 bg-amber-50 text-left text-xs text-amber-800">
                    <p>
                      Este romaneio já possui{' '}
                      <span className="font-semibold">{existingItens.length}</span> itens
                      cadastrados. Os novos itens importados serão adicionados a ele.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="pt-3 border-t">
            {step > 1 && (
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={() => setStep((s) => (s - 1) as any)}
              >
                Voltar
              </Button>
            )}
            {step === 2 && (
              <Button
                type="button"
                onClick={processSheetRows}
                disabled={loading}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Buscando produtos...
                  </>
                ) : (
                  <>
                    Processar Colunas <ArrowRight className="w-4 h-4 ml-1" />
                  </>
                )}
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
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {importProgress
                      ? `Salvando... ${importProgress.current}/${importProgress.total}`
                      : 'Importando...'}
                  </>
                ) : (
                  'Confirmar Importação'
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProdutoModal
        open={produtoModalState.open}
        onOpenChange={(v: boolean) => setProdutoModalState((prev) => ({ ...prev, open: v }))}
        produto={produtoModalState.produto}
        initialData={produtoModalState.initialData}
        onSuccess={(prod: Produto) => {
          if (produtoModalState.rowId) {
            setRowProduto(produtoModalState.rowId, prod)
          }
        }}
      />
    </>
  )
}
