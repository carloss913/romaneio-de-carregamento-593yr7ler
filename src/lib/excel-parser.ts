import * as XLSX from 'xlsx'
import { parseBrazilianWeight } from './conversion'

export interface ParsedSheetData {
  headers: string[]
  rows: Record<string, string>[]
}

/**
 * Converte qualquer valor de célula (string, número, booleano ou data) em
 * string. Necessário porque o SheetJS retorna valores tipados para células
 * numéricas do Excel, enquanto o contrato do parser é texto puro.
 */
function cellToString(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (value instanceof Date) return value.toLocaleDateString('pt-BR')

  // Trata CellObjects do XLSX (ex: { t: 'n', v: 3 } ou { t: 's', v: 'texto', w: '3,00' })
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    if ('v' in obj && obj.v != null) {
      return cellToString(obj.v)
    }
    if ('w' in obj && obj.w != null) {
      return String(obj.w)
    }
  }

  return String(value)
}

/**
 * Lê planilhas .xls, .xlsx, .xlsm e .csv usando SheetJS (xlsx), que detecta o
 * formato automaticamente a partir do conteúdo do arquivo — inclusive o .xls
 * binário (BIFF/CFB, assinatura D0CF11E0), que antes era rejeitado.
 *
 * A opção `raw: true` na leitura preserva os valores de CSV/PRN como texto
 * (em vez de interpretá-los como números/datas), o que mantém decimais no
 * formato brasileiro ("12,5") intactos para o `parseBrazilianWeight`.
 */
export async function parseExcelOrCsvFile(file: File): Promise<ParsedSheetData> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array', raw: true })

  const firstSheetName = workbook.SheetNames[0]
  if (!firstSheetName) throw new Error('Nenhuma planilha encontrada no arquivo.')

  const sheet = workbook.Sheets[firstSheetName]
  if (!sheet) throw new Error('Nenhuma planilha encontrada no arquivo.')

  const matrix = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    blankrows: false,
    defval: '',
    raw: true,
  }) as unknown[][]

  if (matrix.length === 0) throw new Error('O arquivo enviado está vazio.')

  const maxCols = matrix.reduce((max, row) => Math.max(max, row.length), 0)

  const headerRow = matrix[0] ?? []
  const headers: string[] = []
  for (let c = 0; c < maxCols; c++) {
    const header = cellToString(headerRow[c])
    headers.push(header || `Coluna ${c + 1}`)
  }

  const rows: Record<string, string>[] = []
  for (let r = 1; r < matrix.length; r++) {
    const row = matrix[r]
    const obj: Record<string, string> = {}
    let hasData = false
    for (let c = 0; c < maxCols; c++) {
      const value = cellToString(row[c])
      obj[headers[c]] = value
      if (value) hasData = true
    }
    if (hasData) rows.push(obj)
  }

  return { headers, rows }
}

export function validateWeightInput(val: string | number): number {
  return parseBrazilianWeight(val)
}
