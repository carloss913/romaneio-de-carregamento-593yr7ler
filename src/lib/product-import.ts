import { Produto } from '@/types/database'
import type { ParsedSheetData } from './excel-parser'

export type ProductField = 'codigo' | 'nome' | 'peso_caixa_kg' | 'peso_peca_kg' | 'pecas_por_caixa'

export const PRODUCT_FIELDS: { key: ProductField; label: string; required: boolean }[] = [
  { key: 'codigo', label: 'Código', required: true },
  { key: 'nome', label: 'Nome', required: true },
  { key: 'peso_caixa_kg', label: 'Peso da Caixa (kg)', required: false },
  { key: 'peso_peca_kg', label: 'Peso da Peça (kg)', required: false },
  { key: 'pecas_por_caixa', label: 'Peças por Caixa', required: false },
]

const SUGGESTIONS: [RegExp, ProductField][] = [
  [/id_produto/i, 'codigo'],
  [/cod/i, 'codigo'],
  [/descri/i, 'nome'],
  [/nome/i, 'nome'],
  [/produto/i, 'nome'],
  [/peso.*caixa/i, 'peso_caixa_kg'],
  [/peso.*pe[çc]a/i, 'peso_peca_kg'],
  [/pe[çc]as.*caixa/i, 'pecas_por_caixa'],
]

export function autoSuggestMappings(headers: string[]): Record<ProductField, string> {
  const mapping: Record<ProductField, string> = {
    codigo: '',
    nome: '',
    peso_caixa_kg: '',
    peso_peca_kg: '',
    pecas_por_caixa: '',
  }
  const used = new Set<string>()
  for (const header of headers) {
    for (const [regex, field] of SUGGESTIONS) {
      if (regex.test(header) && !mapping[field] && !used.has(header)) {
        mapping[field] = header
        used.add(header)
        break
      }
    }
  }
  return mapping
}

export interface ProductRow {
  id: string
  codigo: string
  nome: string
  peso_caixa_kg: string
  peso_peca_kg: string
  pecas_por_caixa: string
  status: 'novo' | 'atualizar'
  errors: Record<string, string>
  existingId?: string
}

function toNum(s: string): number {
  return parseFloat(s.replace(',', '.').trim())
}

export function processRows(
  data: ParsedSheetData,
  mapping: Record<ProductField, string>,
  existing: Produto[],
): ProductRow[] {
  const byCodigo = new Map<string, Produto>()
  existing.forEach((p) => {
    if (p.codigo) byCodigo.set(p.codigo.trim(), p)
  })

  return data.rows.map((row, idx) => {
    const codigo = mapping.codigo ? (row[mapping.codigo] || '').trim() : ''
    const nome = mapping.nome ? (row[mapping.nome] || '').trim() : ''
    const pesoCaixa = mapping.peso_caixa_kg ? (row[mapping.peso_caixa_kg] || '').trim() : ''
    const pesoPeca = mapping.peso_peca_kg ? (row[mapping.peso_peca_kg] || '').trim() : ''
    let pecas = mapping.pecas_por_caixa ? (row[mapping.pecas_por_caixa] || '').trim() : ''

    const pc = toNum(pesoCaixa)
    const pp = toNum(pesoPeca)
    if ((!pecas || isNaN(toNum(pecas))) && pc > 0 && pp > 0) {
      pecas = String(Math.round(pc / pp))
    }

    const ex = codigo ? byCodigo.get(codigo) : undefined
    return {
      id: `row-${idx}`,
      codigo,
      nome,
      peso_caixa_kg: pesoCaixa,
      peso_peca_kg: pesoPeca,
      pecas_por_caixa: pecas,
      status: ex ? 'atualizar' : 'novo',
      errors: {},
      existingId: ex?.id,
    }
  })
}

export function validateRows(rows: ProductRow[]): ProductRow[] {
  const codigoCount = new Map<string, number>()
  const nomeCount = new Map<string, number>()
  rows.forEach((r) => {
    const c = r.codigo.trim().toLowerCase()
    const n = r.nome.trim().toLowerCase()
    if (c) codigoCount.set(c, (codigoCount.get(c) || 0) + 1)
    if (n) nomeCount.set(n, (nomeCount.get(n) || 0) + 1)
  })

  return rows.map((r) => {
    const errors: Record<string, string> = {}
    const c = r.codigo.trim().toLowerCase()
    const n = r.nome.trim().toLowerCase()

    if (!r.codigo.trim()) errors.codigo = 'Código obrigatório'
    else if ((codigoCount.get(c) || 0) > 1) errors.codigo = 'Código duplicado no arquivo'

    if (!r.nome.trim()) errors.nome = 'Nome obrigatório'
    else if ((nomeCount.get(n) || 0) > 1) errors.nome = 'Nome duplicado no arquivo'

    return { ...r, errors }
  })
}
