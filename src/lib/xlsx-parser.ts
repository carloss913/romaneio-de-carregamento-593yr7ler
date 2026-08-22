export interface ParsedSheetData {
  headers: string[]
  rows: Record<string, string>[]
}

interface ZipEntry {
  name: string
  compressionMethod: number
  compressedData: Uint8Array
}

function findEocd(data: Uint8Array): number {
  for (let i = data.length - 22; i >= 0; i--) {
    if (data[i] === 0x50 && data[i + 1] === 0x4b && data[i + 2] === 0x05 && data[i + 3] === 0x06) {
      return i
    }
  }
  return -1
}

function parseZipEntries(data: Uint8Array): ZipEntry[] {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  const eocdOffset = findEocd(data)
  if (eocdOffset === -1) throw new Error('Arquivo XLSX inválido.')

  const cdOffset = view.getUint32(eocdOffset + 16, true)
  const cdEntries = view.getUint16(eocdOffset + 10, true)

  const entries: ZipEntry[] = []
  let offset = cdOffset

  for (let i = 0; i < cdEntries; i++) {
    if (view.getUint32(offset, true) !== 0x02014b50) break
    const compressionMethod = view.getUint16(offset + 10, true)
    const compressedSize = view.getUint32(offset + 20, true)
    const filenameLen = view.getUint16(offset + 28, true)
    const extraLen = view.getUint16(offset + 30, true)
    const commentLen = view.getUint16(offset + 32, true)
    const localHeaderOffset = view.getUint32(offset + 42, true)

    const filename = new TextDecoder().decode(data.slice(offset + 46, offset + 46 + filenameLen))

    const localFilenameLen = view.getUint16(localHeaderOffset + 26, true)
    const localExtraLen = view.getUint16(localHeaderOffset + 28, true)
    const dataStart = localHeaderOffset + 30 + localFilenameLen + localExtraLen
    const compressedData = data.slice(dataStart, dataStart + compressedSize)

    entries.push({ name: filename, compressionMethod, compressedData })
    offset += 46 + filenameLen + extraLen + commentLen
  }

  return entries
}

async function decompressDeflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Response(data.buffer as unknown as BodyInit).body!
  const decompressed = stream.pipeThrough(new DecompressionStream('deflate-raw'))
  const buffer = await new Response(decompressed).arrayBuffer()
  return new Uint8Array(buffer)
}

async function getEntryText(entry: ZipEntry): Promise<string> {
  let bytes: Uint8Array
  if (entry.compressionMethod === 0) {
    bytes = entry.compressedData
  } else if (entry.compressionMethod === 8) {
    bytes = await decompressDeflate(entry.compressedData)
  } else {
    throw new Error(`Compressão não suportada: ${entry.compressionMethod}`)
  }
  return new TextDecoder().decode(bytes)
}

function parseSharedStrings(xml: string): string[] {
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  const sis = doc.getElementsByTagName('si')
  const strings: string[] = []
  for (let i = 0; i < sis.length; i++) {
    const ts = sis[i].getElementsByTagName('t')
    let text = ''
    for (let j = 0; j < ts.length; j++) text += ts[j].textContent || ''
    strings.push(text)
  }
  return strings
}

function colToIndex(letters: string): number {
  let r = 0
  for (let i = 0; i < letters.length; i++) r = r * 26 + (letters.charCodeAt(i) - 64)
  return r - 1
}

function parseSheet(xml: string, sharedStrings: string[]): ParsedSheetData {
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  const xmlRows = doc.getElementsByTagName('row')
  const grid: Record<number, Record<number, string>> = {}
  let maxCol = 0

  for (let i = 0; i < xmlRows.length; i++) {
    const row = xmlRows[i]
    const rowNum = parseInt(row.getAttribute('r') || '0') - 1
    const cells = row.getElementsByTagName('c')
    const rowData: Record<number, string> = {}
    for (let j = 0; j < cells.length; j++) {
      const cell = cells[j]
      const ref = cell.getAttribute('r') || ''
      const colMatch = ref.match(/^[A-Z]+/)
      if (!colMatch) continue
      const colIdx = colToIndex(colMatch[0])
      const type = cell.getAttribute('t')
      const v = cell.getElementsByTagName('v')[0]
      const val = v?.textContent || ''
      rowData[colIdx] = type === 's' ? sharedStrings[parseInt(val)] || '' : val
      if (colIdx > maxCol) maxCol = colIdx
    }
    grid[rowNum] = rowData
  }

  const headers: string[] = []
  for (let c = 0; c <= maxCol; c++) headers.push((grid[0] || {})[c] || `Coluna ${c + 1}`)

  const rows: Record<string, string>[] = []
  const keys = Object.keys(grid)
    .map(Number)
    .sort((a, b) => a - b)
  for (const r of keys) {
    if (r === 0) continue
    const obj: Record<string, string> = {}
    let hasData = false
    for (let c = 0; c <= maxCol; c++) {
      const val = grid[r][c] || ''
      obj[headers[c]] = val
      if (val) hasData = true
    }
    if (hasData) rows.push(obj)
  }

  return { headers, rows }
}

export async function parseXlsxFile(file: File): Promise<ParsedSheetData> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const entries = parseZipEntries(bytes)

  let sharedStrings: string[] = []
  const ssEntry = entries.find((e) => e.name === 'xl/sharedStrings.xml')
  if (ssEntry) sharedStrings = parseSharedStrings(await getEntryText(ssEntry))

  const sheetEntry = entries.find((e) => e.name.startsWith('xl/worksheets/sheet'))
  if (!sheetEntry) throw new Error('Nenhuma planilha encontrada no arquivo .xlsx')

  return parseSheet(await getEntryText(sheetEntry), sharedStrings)
}
