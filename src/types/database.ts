import { RecordModel } from 'pocketbase'

export type RotaType = 'Piçarra' | 'SFX' | 'Tucumã' | 'Floresta' | 'Outros'

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
  return SECAO_ORDER[secao || ''] ?? 99
}

export const ROTAS: { name: RotaType; color: string; bg: string; border: string; text: string }[] =
  [
    {
      name: 'Piçarra',
      color: '#78716c',
      bg: 'bg-stone-500/10',
      border: 'border-stone-500',
      text: 'text-stone-700',
    },
    {
      name: 'SFX',
      color: '#3b82f6',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500',
      text: 'text-blue-700',
    },
    {
      name: 'Tucumã',
      color: '#22c55e',
      bg: 'bg-green-500/10',
      border: 'border-green-500',
      text: 'text-green-700',
    },
    {
      name: 'Floresta',
      color: '#059669',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500',
      text: 'text-emerald-700',
    },
    {
      name: 'Outros',
      color: '#a855f7',
      bg: 'bg-purple-500/10',
      border: 'border-purple-500',
      text: 'text-purple-700',
    },
  ]
