import { parseBrazilianWeight } from './conversion'
import { parseXlsxFile, type ParsedSheetData } from './xlsx-parser'

export type { ParsedSheetData }

export async function parseExcelOrCsvFile(file: File): Promise<ParsedSheetData> {
  const ext = file.name.split('.').pop()?.toLowerCase()

  if (ext === 'xlsx') {
    return parseXlsxFile(file)
  }

  const buffer = await file.arrayBuffer()

  if (ext === 'xls') {
    const sig = new Uint8Array(buffer.slice(0, 4))
    if (sig[0] === 0xd0 && sig[1] === 0xcf && sig[2] === 0x11 && sig[3] === 0xe0) {
      throw new Error('Formato .xls binário não suportado. Converta para .xlsx ou .csv.')
    }
  }

  const text = new TextDecoder().decode(buffer)
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0)
  if (lines.length === 0) throw new Error('O arquivo enviado está vazio.')

  const delimiter = lines[0].includes(';') ? ';' : lines[0].includes('\t') ? '\t' : ','
  const parsedLines = lines.map((line) =>
    line.split(delimiter).map((cell) => cell.replace(/^["']|["']$/g, '').trim()),
  )

  const headers = parsedLines[0].map((h, i) => h || `Coluna ${i + 1}`)
  const dataRows = parsedLines.slice(1)

  const rows: Record<string, string>[] = dataRows.map((row) => {
    const obj: Record<string, string> = {}
    headers.forEach((header, index) => {
      obj[header] = row[index] || ''
    })
    return obj
  })

  return { headers, rows }
}

export function validateWeightInput(val: string | number): number {
  return parseBrazilianWeight(val)
}
