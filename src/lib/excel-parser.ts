import { parseBrazilianWeight } from './conversion'

export interface ParsedSheetData {
  headers: string[]
  rows: Record<string, string>[]
}

export async function parseExcelOrCsvFile(file: File): Promise<ParsedSheetData> {
  const text = await file.text()
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0)

  if (lines.length === 0) {
    throw new Error('O arquivo enviado está vazio.')
  }

  const delimiter = lines[0].includes(';') ? ';' : lines[0].includes('\t') ? '\t' : ','

  const parsedLines = lines.map((line) =>
    line.split(delimiter).map((cell) => cell.replace(/^["']|["']$/g, '').trim()),
  )

  const headers = parsedLines[0].map((h, i) => h || `Coluna ${i + 1}`)
  const dataRows = parsedLines.slice(1)

  const rows: Record<string, string>[] = dataRows.map((row) => {
    const rowObj: Record<string, string> = {}
    headers.forEach((header, index) => {
      rowObj[header] = row[index] || ''
    })
    return rowObj
  })

  return { headers, rows }
}

export function validateWeightInput(val: string | number): number {
  return parseBrazilianWeight(val)
}
