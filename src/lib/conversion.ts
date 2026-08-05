export interface ConversionResult {
  caixas: number
  pecas: number
  textoFormatado: string
  weightWarning: boolean
  weightWarningMessage?: string
}

export function hasPecaData(pesoPecaKg?: number, pecasPorCaixa?: number): boolean {
  return (pesoPecaKg ?? 0) > 0 && (pecasPorCaixa ?? 0) > 0
}

export function convertWeightToBoxesAndPieces(
  pesoTotalKg: number,
  pesoCaixaKg?: number,
  pesoPecaKg?: number,
  pecasPorCaixa?: number,
): ConversionResult {
  if (pesoTotalKg <= 0) {
    return {
      caixas: 0,
      pecas: 0,
      textoFormatado: '0 cx',
      weightWarning: true,
      weightWarningMessage: 'Peso inválido (zero, negativo ou em branco).',
    }
  }

  const pc = pesoCaixaKg ?? 0
  if (pc <= 0) {
    return {
      caixas: 0,
      pecas: 0,
      textoFormatado: '0 cx',
      weightWarning: false,
    }
  }

  const caixas = Math.floor(pesoTotalKg / pc)
  const restoKg = pesoTotalKg - caixas * pc

  if (!hasPecaData(pesoPecaKg, pecasPorCaixa)) {
    const tolerance = Math.max(pc * 0.1, 0.5)
    if (Math.abs(restoKg) > tolerance) {
      return {
        caixas,
        pecas: 0,
        textoFormatado: formatBoxesAndPieces(caixas, 0),
        weightWarning: true,
        weightWarningMessage: `Peso não é múltiplo de ${pc}kg (resto: ${restoKg.toFixed(2)}kg).`,
      }
    }
    return {
      caixas,
      pecas: 0,
      textoFormatado: formatBoxesAndPieces(caixas, 0),
      weightWarning: false,
    }
  }

  const pp = pesoPecaKg ?? 0
  const pecas = Math.round(restoKg / pp)
  const reconstructedWeight = caixas * pc + pecas * pp
  const diff = Math.abs(pesoTotalKg - reconstructedWeight)
  const tolerance = Math.max(pp * 0.1, 0.05)

  if (diff > tolerance) {
    return {
      caixas,
      pecas,
      textoFormatado: formatBoxesAndPieces(caixas, pecas),
      weightWarning: true,
      weightWarningMessage: 'Peso parece incorreto — verifique se houve erro de digitação.',
    }
  }

  if (pecas >= (pecasPorCaixa ?? 0)) {
    return {
      caixas,
      pecas,
      textoFormatado: formatBoxesAndPieces(caixas, pecas),
      weightWarning: true,
      weightWarningMessage: `Peças (${pecas}) excedem o esperado por caixa (${pecasPorCaixa}).`,
    }
  }

  return {
    caixas,
    pecas,
    textoFormatado: formatBoxesAndPieces(caixas, pecas),
    weightWarning: false,
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
