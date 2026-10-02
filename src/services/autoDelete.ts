import pb from '@/lib/pocketbase/client'
import { getConfiguracoes, saveConfiguracoes } from '@/services/configuracoes'

/**
 * Chave de localStorage legada que guardava o número de meses para a exclusão
 * automática de romaneios finalizados antigos. Mantida para fins de fallback / migração.
 */
export const AUTO_DELETE_STORAGE_KEY = 'autoDeleteMonths'

/**
 * Opções de meses disponíveis para a limpeza automática.
 * O primeiro valor (0) representa "Desativado".
 */
export const AUTO_DELETE_OPTIONS = [0, 3, 4, 5, 6] as const

/**
 * Lê o valor do localStorage legado (se houver).
 */
export function getLocalAutoDeleteMonths(): number {
  if (typeof window === 'undefined' || !window.localStorage) return 0
  const raw = window.localStorage.getItem(AUTO_DELETE_STORAGE_KEY)
  const months = Number(raw)
  if (!Number.isFinite(months) || months <= 0) return 0
  return Math.round(months)
}

/**
 * Limpa o valor legado do localStorage.
 */
export function clearLocalAutoDeleteMonths(): void {
  if (typeof window === 'undefined' || !window.localStorage) return
  window.localStorage.removeItem(AUTO_DELETE_STORAGE_KEY)
}

/**
 * Obtém o prazo de limpeza automática configurado no servidor.
 * Caso o servidor ainda não possua o valor (ou seja 0) e haja um valor
 * legado configurado no localStorage deste dispositivo, migra o valor para o servidor.
 */
export async function getAutoDeleteMonths(): Promise<number> {
  try {
    const config = await getConfiguracoes()
    const serverValue = config?.auto_delete_months

    if (serverValue !== undefined && serverValue !== null && serverValue > 0) {
      // Servidor tem um valor configurado ativo. Atualiza o localStorage se necessário.
      clearLocalAutoDeleteMonths()
      return Math.round(serverValue)
    }

    // Se o servidor tem 0 explícito ou não tem registro, verifica se há valor no localStorage para migrar
    const localVal = getLocalAutoDeleteMonths()
    if (localVal > 0) {
      // Migra valor local para o servidor
      try {
        await saveConfiguracoes({ auto_delete_months: localVal })
        clearLocalAutoDeleteMonths()
        return localVal
      } catch (err) {
        console.warn('Não foi possível migrar autoDeleteMonths local para o servidor:', err)
        return localVal
      }
    }

    // Se não há nada no local e o servidor tem 0 ou null, retorna 0 (desativado)
    return serverValue ? Math.round(serverValue) : 0
  } catch (err) {
    console.warn('Erro ao obter auto_delete_months do servidor, fallback local:', err)
    return getLocalAutoDeleteMonths()
  }
}

/**
 * Salva o prazo de limpeza automática no servidor para que todos os navegadores reflitam o valor global.
 * Também sincroniza/limpa o localStorage local.
 */
export async function setAutoDeleteMonths(months: number): Promise<number> {
  const safeMonths = !Number.isFinite(months) || months <= 0 ? 0 : Math.round(months)
  await saveConfiguracoes({ auto_delete_months: safeMonths })
  clearLocalAutoDeleteMonths()
  return safeMonths
}

/**
 * Mantido como no-op assíncrono para retrocompatibilidade caso algum import
 * legado tente chamar runAutoDelete. O executor real é o cron job do servidor.
 */
export async function runAutoDelete(): Promise<number> {
  return 0
}
