import { RecordModel } from 'pocketbase'

export type RotaType = string

export interface Rota extends RecordModel {
  nome: string
  cor?: string
  ativa: boolean
  ordem?: number
}

export interface Produto extends RecordModel {
  codigo: string
  nome: string
  marca?: string
  secao?: 'CONGELADO' | 'GERAL' | 'RESFRIADO'
  peso_caixa_kg?: number
  pecas_por_caixa?: number
  peso_peca_kg?: number
  ativo: boolean
}

export interface Romaneio extends RecordModel {
  rota: RotaType
  data: string
  status: 'em_andamento' | 'finalizado'
  observacoes?: string
  arquivo_planilha?: string
}

export interface RomaneioItem extends RecordModel {
  romaneio: string
  produto: string
  peso_total_kg: number
  caixas: number
  pecas: number
  carregado: boolean
  observacao?: string
  expand?: {
    produto?: Produto
    romaneio?: Romaneio
  }
}

export interface Configuracoes extends RecordModel {
  telefone_whatsapp: string
  nome_destinatario: string
  telefone_contato?: string
  nome_contato?: string
}

export const SECAO_ORDER: Record<string, number> = {
  CONGELADO: 0,
  GERAL: 1,
  RESFRIADO: 2,
}

export function getSecaoOrder(secao?: string): number {
  return SECAO_ORDER[(secao || '').trim().toUpperCase()] ?? 99
}

const ROTAS_COLOR_PALETTE = [
  '#78716c',
  '#3b82f6',
  '#22c55e',
  '#059669',
  '#a855f7',
  '#f59e0b',
  '#0ea5e9',
  '#ec4899',
  '#dc2626',
  '#14b8a6',
]

export function stringToColor(str: string): string {
  if (!str) return '#78716c'
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = str.charCodeAt(i) + ((h << 5) - h)
  }
  return ROTAS_COLOR_PALETTE[Math.abs(h) % ROTAS_COLOR_PALETTE.length]
}
