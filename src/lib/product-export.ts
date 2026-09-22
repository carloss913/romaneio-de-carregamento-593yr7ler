import { Produto } from '@/types/database'
import { formatWeight } from '@/lib/conversion'

/**
 * Escapa uma célula para CSV padrão RFC 4180 com separador ';'.
 * Se contiver ';', quebra de linha ou aspas duplas, coloca entre aspas e duplica aspas internas.
 */
export function escapeCsvCell(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === '') {
    return ''
  }
  const str = String(val)
  if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export interface ProductExportRow {
  codigo: string
  nome: string
  unidadeMedida: string
  pesoKg: string
  pecasPorCaixa: string
  pesoPorCaixaKg: string
}

/**
 * Converte um produto nos campos solicitados para exportação:
 * 1. Código do produto
 * 2. Nome
 * 3. Unidade de medida (kg / unidade / pacote)
 * 4. Peso (kg) — peso unitário cadastrado
 * 5. Peças por caixa
 * 6. Peso por caixa (kg) — peso da caixa (ou calculado peso x peças por caixa)
 *
 * Regras de preenchimento conforme a especificação:
 * - KG: preencher peso (kg), peças por caixa e peso por caixa.
 *   Se não tiver caixa definida (vendido a granel / peso_caixa e pecas <= 0), colunas de caixa ficam vazias.
 * - Unidade: preencher peças por caixa (unidades por caixa) e deixar peso (kg) vazio. Peso por caixa também vazio.
 * - Pacote: preencher peças por caixa (unidades por pacote) e deixar peso vazio. Peso por caixa também vazio.
 * - Números decimais com vírgula como separador decimal e 3 casas decimais nos pesos com decimais (formatWeight).
 */
export function formatProductExportRow(p: Produto): ProductExportRow {
  const unidade = p.unidade_medida || 'kg'
  const isUn = unidade === 'unidade'
  const isPacote = unidade === 'pacote'

  if (isUn || isPacote) {
    const pecas = p.pecas_por_caixa && p.pecas_por_caixa > 0 ? String(p.pecas_por_caixa) : ''
    return {
      codigo: p.codigo || '',
      nome: p.nome || '',
      unidadeMedida: unidade,
      pesoKg: '',
      pecasPorCaixa: pecas,
      pesoPorCaixaKg: '',
    }
  }

  // Produto em KG
  // Peso unitário (peso da peça)
  const pesoUnitarioNum = p.peso_peca_kg && p.peso_peca_kg > 0 ? p.peso_peca_kg : null
  const pesoKgStr = pesoUnitarioNum !== null ? formatWeight(pesoUnitarioNum) : ''

  // Peças por caixa
  const pecasNum = p.pecas_por_caixa && p.pecas_por_caixa > 0 ? p.pecas_por_caixa : null
  const pecasStr = pecasNum !== null ? String(pecasNum) : ''

  // Peso por caixa (kg): usa peso_caixa_kg se cadastrado > 0;
  // se não tiver peso_caixa_kg mas tiver peso_peca e pecas, calcula peso_peca * pecas.
  let pesoCaixaNum: number | null = null
  if (p.peso_caixa_kg && p.peso_caixa_kg > 0) {
    pesoCaixaNum = p.peso_caixa_kg
  } else if (pesoUnitarioNum !== null && pecasNum !== null) {
    pesoCaixaNum = Math.round(pesoUnitarioNum * pecasNum * 1000) / 1000
  }

  const pesoPorCaixaStr = pesoCaixaNum !== null ? formatWeight(pesoCaixaNum) : ''

  return {
    codigo: p.codigo || '',
    nome: p.nome || '',
    unidadeMedida: unidade,
    pesoKg: pesoKgStr,
    pecasPorCaixa: pecasStr,
    pesoPorCaixaKg: pesoPorCaixaStr,
  }
}

/**
 * Gera o conteúdo CSV completo formatado com BOM UTF-8 e separador ';'.
 */
export function generateProdutosCsv(produtos: Produto[]): string {
  const headers = [
    'Código do produto',
    'Nome',
    'Unidade de medida',
    'Peso (kg)',
    'Peças por caixa',
    'Peso por caixa (kg)',
  ]

  const lines: string[] = []
  lines.push(headers.map(escapeCsvCell).join(';'))

  for (const p of produtos) {
    const row = formatProductExportRow(p)
    const line = [
      escapeCsvCell(row.codigo),
      escapeCsvCell(row.nome),
      escapeCsvCell(row.unidadeMedida),
      escapeCsvCell(row.pesoKg),
      escapeCsvCell(row.pecasPorCaixa),
      escapeCsvCell(row.pesoPorCaixaKg),
    ].join(';')
    lines.push(line)
  }

  // BOM UTF-8 (\uFEFF) para que o Excel abra automaticamente com acentuação correta em pt-BR
  return '\uFEFF' + lines.join('\r\n')
}

/**
 * Dispara o download do arquivo CSV no navegador.
 */
export function downloadProdutosCsv(produtos: Produto[], filename?: string): void {
  const csvContent = generateProdutosCsv(produtos)
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const dateStr = new Date().toISOString().split('T')[0]
  const finalFilename = filename || `produtos-${dateStr}.csv`

  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', finalFilename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
