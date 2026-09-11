export interface ConversionResult {
  caixas: number
  pecas: number
  textoFormatado: string
  weightWarning: boolean
  weightWarningMessage?: string
}

export function isUnidadeProduto(unidadeMedida?: string | null): boolean {
  return unidadeMedida === 'unidade'
}

export function isPacoteProduto(unidadeMedida?: string | null): boolean {
  return unidadeMedida === 'pacote'
}

export function isNonKgProduto(unidadeMedida?: string | null): boolean {
  return unidadeMedida === 'unidade' || unidadeMedida === 'pacote'
}

export function hasPecaData(pesoPecaKg?: number, pecasPorCaixa?: number): boolean {
  return (pesoPecaKg ?? 0) > 0 && (pecasPorCaixa ?? 0) > 0
}

/**
 * Conversão específica para produtos vendidos por unidade.
 * A quantidade informada é em unidades (ex.: 24 copos de água de coco).
 * - Se pecasPorCaixa (unidades por caixa) estiver configurado > 0:
 *   caixas = Math.floor(quantidade / unidadesPorCaixa)
 *   pecas = quantidade % unidadesPorCaixa (restante avulso em unidades)
 * - Se não houver pecasPorCaixa:
 *   caixas = 0, pecas = quantidade
 */
export function convertUnitsToBoxesAndPieces(
  quantidadeTotal: number,
  unidadesPorCaixa?: number,
): ConversionResult {
  if (quantidadeTotal <= 0) {
    return {
      caixas: 0,
      pecas: 0,
      textoFormatado: '0 un',
      weightWarning: true,
      weightWarningMessage: 'Quantidade inválida (zero, negativa ou em branco).',
    }
  }

  const upc = Math.round(unidadesPorCaixa ?? 0)
  if (upc <= 0) {
    const qtdRound = Math.round(quantidadeTotal)
    return {
      caixas: 0,
      pecas: qtdRound,
      textoFormatado: `${qtdRound} un`,
      weightWarning: false,
    }
  }

  const caixas = Math.floor(quantidadeTotal / upc)
  const pecas = Math.round(quantidadeTotal % upc)

  let texto = ''
  if (caixas > 0 && pecas > 0) {
    texto = `${caixas} cx + ${pecas} un`
  } else if (caixas > 0) {
    texto = `${caixas} cx`
  } else {
    texto = `${pecas} un`
  }

  return {
    caixas,
    pecas,
    textoFormatado: texto,
    weightWarning: false,
  }
}

/**
 * Conversão específica para produtos vendidos por pacote (ex.: espetinhos em pacotes de 5).
 * A quantidade da planilha é o número de espetos/unidades.
 * Pacotes são LACRADOS: não existe venda de unidades soltas.
 * - Se a quantidade divide perfeitamente por unidadesPorPacote (resto == 0):
 *   pacotes = quantidade / unidadesPorPacote, pecas = 0, weightWarning = false
 * - Se a quantidade NÃO divide perfeitamente (resto != 0):
 *   dispara alerta de quantidade/peso suspeito (weightWarning = true),
 *   cai no mesmo fluxo de conferência de peso do wizard de importação.
 * - Se unidadesPorPacote não estiver definido (<= 0), mostra a quantidade total como "X un".
 */
export function convertPackagesToBoxesAndPieces(
  quantidadeTotal: number,
  unidadesPorPacote?: number,
): ConversionResult {
  if (quantidadeTotal <= 0) {
    return {
      caixas: 0,
      pecas: 0,
      textoFormatado: '0 un',
      weightWarning: true,
      weightWarningMessage: 'Quantidade inválida (zero, negativa ou em branco).',
    }
  }

  const upp = Math.round(unidadesPorPacote ?? 0)
  if (upp <= 0) {
    const qtdRound = Math.round(quantidadeTotal)
    return {
      caixas: 0,
      pecas: qtdRound,
      textoFormatado: `${qtdRound} un`,
      weightWarning: false,
    }
  }

  const pacotes = Math.floor(quantidadeTotal / upp)
  const resto = Math.round(quantidadeTotal % upp)

  if (resto !== 0) {
    // Pacotes são lacrados — não fecha em pacotes inteiros! Alerta de quantidade/peso incorreto
    return {
      caixas: pacotes,
      pecas: resto,
      textoFormatado: pacotes > 0 ? `${pacotes} pct` : `${quantidadeTotal} un`,
      weightWarning: true,
      weightWarningMessage: `Quantidade não fecha em pacotes fechados de ${upp} un (sobra ${resto} un — pacotes são lacrados).`,
    }
  }

  return {
    caixas: pacotes,
    pecas: 0,
    textoFormatado: `${pacotes} pct`,
    weightWarning: false,
  }
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

  const caixas = Math.floor(pesoTotalKg / pc + 0.0001)
  const restoKg = Math.max(0, Math.round((pesoTotalKg - caixas * pc) * 10000) / 10000)

  if (!hasPecaData(pesoPecaKg, pecasPorCaixa)) {
    const tolerance = Math.max(pc * 0.1, 0.5)
    if (Math.abs(restoKg) > tolerance) {
      return {
        caixas,
        pecas: 0,
        textoFormatado: formatBoxesAndPieces(caixas, 0),
        weightWarning: true,
        weightWarningMessage: `Peso não é múltiplo de ${pc}kg (resto: ${formatWeight(restoKg)}kg).`,
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

export function formatBoxesAndPieces(
  caixas: number,
  pecas: number,
  unidadeMedida?: string | null,
): string {
  const isUn = isUnidadeProduto(unidadeMedida)
  const isPct = isPacoteProduto(unidadeMedida)

  if (isPct) {
    if (caixas === 0 && pecas === 0) return '0 pct'
    if (caixas > 0) return `${caixas} pct`
    return `${pecas} un`
  }

  const sufixoPeca = isUn ? 'un' : 'pct'

  if (caixas === 0 && pecas === 0) return isUn ? '0 un' : '0 cx'
  if (caixas > 0 && pecas > 0) return `${caixas} cx + ${pecas} ${sufixoPeca}`
  if (caixas > 0) return `${caixas} cx`
  return `${pecas} ${sufixoPeca}`
}

/**
 * Formata a quantidade/peso de um produto respeitando sua unidade de medida.
 * Para itens em unidade: exibe "24 un" (nunca "24kg").
 * Para itens em pacote: exibe "24 un" (a quantidade da planilha é em espetos/unidades).
 * Para itens em kg: exibe "24 kg".
 */
export function formatProductAmount(
  valor: number | null | undefined,
  unidadeMedida?: string | null,
): string {
  const formatted = formatWeight(valor)
  if (isUnidadeProduto(unidadeMedida) || isPacoteProduto(unidadeMedida)) {
    return `${formatted} un`
  }
  return `${formatted} kg`
}

/**
 * Formata um peso em kg (ou unidades decimais):
 * Caso o peso tenha casa decimal, exibe com exatamente 3 casas após a vírgula (ex.: 2,5 -> "2,500", 1,275 -> "1,275").
 * Se for número inteiro, exibe sem casas decimais (ex.: 10 -> "10", 0 -> "0").
 */
export function formatWeight(peso: number | null | undefined): string {
  if (peso == null || isNaN(peso)) return '0'
  // Limita a 3 casas decimais arredondando eventuais dízimas de ponto flutuante do JS
  const fixed = Number(peso.toFixed(3))
  const hasDecimal = Math.abs(fixed % 1) > 0.00001
  return fixed.toLocaleString('pt-BR', {
    minimumFractionDigits: hasDecimal ? 3 : 0,
    maximumFractionDigits: 3,
  })
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

export function recalculatePesoTotal(
  caixas: number,
  pecas: number,
  pesoCaixaKg?: number,
  pesoPecaKg?: number,
): number {
  const pesoFromCaixas = (pesoCaixaKg ?? 0) * caixas
  const pesoFromPecas = (pesoPecaKg ?? 0) * pecas
  return Math.round((pesoFromCaixas + pesoFromPecas) * 1000) / 1000
}
