import pb from '@/lib/pocketbase/client'
import { Romaneio } from '@/types/database'

/**
 * Chave de localStorage que guarda o número de meses para a exclusão
 * automática de romaneios finalizados antigos. O valor é uma string
 * ("0" = desativado, ou "3".."6" para o número de meses).
 */
export const AUTO_DELETE_STORAGE_KEY = 'autoDeleteMonths'

/**
 * Opções de meses disponíveis para a limpeza automática.
 * O primeiro valor (0) representa "Desativado".
 */
export const AUTO_DELETE_OPTIONS = [0, 3, 4, 5, 6] as const

/**
 * Lê a configuração de exclusão automática do localStorage.
 * Retorna o número de meses (0 = desativado). Valores inválidos
 * ou ausentes retornam 0 (desativado).
 */
export function getAutoDeleteMonths(): number {
  if (typeof window === 'undefined' || !window.localStorage) return 0
  const raw = window.localStorage.getItem(AUTO_DELETE_STORAGE_KEY)
  const months = Number(raw)
  if (!Number.isFinite(months) || months <= 0) return 0
  return Math.round(months)
}

/**
 * Salva a configuração de exclusão automática no localStorage.
 * Valores <= 0 removem a chave (equivale a "Desativado").
 */
export function setAutoDeleteMonths(months: number): void {
  if (typeof window === 'undefined' || !window.localStorage) return
  if (!Number.isFinite(months) || months <= 0) {
    window.localStorage.removeItem(AUTO_DELETE_STORAGE_KEY)
    return
  }
  window.localStorage.setItem(AUTO_DELETE_STORAGE_KEY, String(Math.round(months)))
}

/**
 * Calcula a data limite (ISO string) a partir de hoje menos X meses.
 * Usado para comparar com o campo `updated` dos romaneios finalizados.
 */
function cutoffDateISO(months: number, now: Date = new Date()): string {
  const d = new Date(now)
  d.setMonth(d.getMonth() - months)
  return d.toISOString()
}

/**
 * Executa a rotina de exclusão automática de romaneios finalizados
 * que excedem o prazo configurado em `autoDeleteMonths` (localStorage).
 *
 * - Se a configuração for "Desativado" (0) ou inexistente, não faz nada.
 * - Caso contrário, busca os romaneios com `status = "finalizado"` e
 *   exclui permanentemente aqueles cuja `updated` (data de finalização)
 *   seja anterior ao limite de X meses atrás.
 *
 * A exclusão é DEFINITIVA e não pode ser desfeita.
 *
 * Retorna o número de romaneios excluídos (útil para feedback, se desejado).
 */
export async function runAutoDelete(): Promise<number> {
  const months = getAutoDeleteMonths()
  if (months <= 0) return 0

  const cutoff = cutoffDateISO(months)

  // Busca romaneios finalizados cuja `updated` seja anterior ao corte.
  // O PocketBase aceita o filtro `updated < "ISO"`.
  const alvo = await pb.collection('romaneios').getFullList<Romaneio>({
    filter: `status = "finalizado" && updated < "${cutoff}"`,
  })

  if (alvo.length === 0) return 0

  let excluidos = 0
  await Promise.all(
    alvo.map(async (rom) => {
      try {
        await pb.collection('romaneios').delete(rom.id)
        excluidos++
      } catch {
        // Ignora falhas individuais — itens órfãos podem ter sido
        // removidos por cascata em outra operação.
      }
    }),
  )

  return excluidos
}
