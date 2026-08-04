export interface ConversionResult {
  caixas: number
  pecas: number
  textoFormatado: string
}

export function convertWeightToBoxesAndPieces(
  pesoTotalKg: number,
  pesoCaixaKg: number,
  pesoPecaKg: number,
): ConversionResult {
  if (pesoTotalKg <= 0 || pesoCaixaKg <= 0 || pesoPecaKg <= 0) {
    return { caixas: 0, pecas: 0, textoFormatado: '0 cx' }
  }

  const caixas = Math.floor(pesoTotalKg / pesoCaixaKg)
  const restoKg = pesoTotalKg - caixas * pesoCaixaKg
  const pecas = Math.round(restoKg / pesoPecaKg)

  return {
    caixas,
    pecas,
    textoFormatado: formatBoxesAndPieces(caixas, pecas),
  }
}

export function formatBoxesAndPieces(caixas: number, pecas: number): string {
  if (caixas === 0 && pecas === 0) return '0 cx'
  if (caixas > 0 && pecas > 0) return `${caixas} cx + ${pecas} pct`
  if (caixas > 0) return `${caixas} cx`
  return `${pecas} pct`
}

export function normalizeProductName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

export function parseBrazilianWeight(input: string | number): number {
  if (typeof input === 'number') return isNaN(input) ? 0 : input
  if (!input) return 0
  const cleaned = input.toString().replace(/kg/gi, '').replace(/\s+/g, '').trim()
  if (!cleaned) return 0

  if (cleaned.includes(',') && cleaned.includes('.')) {
    const lastComma = cleaned.lastIndexOf(',')
    const lastDot = cleaned.lastIndexOf('.')
    if (lastComma > lastDot) {
      const norm = cleaned.replace(/\./g, '').replace(',', '.')
      return parseFloat(norm) || 0
    } else {
      const norm = cleaned.replace(/,/g, '')
      return parseFloat(norm) || 0
    }
  }

  if (cleaned.includes(',')) {
    const norm = cleaned.replace(',', '.')
    return parseFloat(norm) || 0
  }

  return parseFloat(cleaned) || 0
}
