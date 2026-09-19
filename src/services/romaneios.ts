import pb from '@/lib/pocketbase/client'
import { Romaneio, RotaType } from '@/types/database'

export const getRomaneios = (filter?: string) =>
  pb.collection('romaneios').getFullList<Romaneio>({
    filter,
    sort: '-data,-created',
  })

export const getRomaneiosByRota = (rota: RotaType) =>
  pb.collection('romaneios').getFullList<Romaneio>({
    filter: `rota = "${rota}"`,
    sort: '-data,-created',
  })

export const getRomaneio = (id: string) => pb.collection('romaneios').getOne<Romaneio>(id)

export const createRomaneio = (data: {
  rota: RotaType
  data: string
  status?: 'em_andamento' | 'finalizado'
  observacoes?: string
  arquivo_planilha?: File
  conferente?: string
}) => {
  const formData = new FormData()
  formData.append('rota', data.rota)
  formData.append('data', data.data)
  formData.append('status', data.status || 'em_andamento')
  if (data.observacoes) formData.append('observacoes', data.observacoes)
  if (data.arquivo_planilha) formData.append('arquivo_planilha', data.arquivo_planilha)
  if (data.conferente !== undefined) formData.append('conferente', data.conferente)

  return pb.collection('romaneios').create<Romaneio>(formData)
}

export const updateRomaneio = (
  id: string,
  data: Partial<{
    rota: RotaType
    data: string
    status: 'em_andamento' | 'finalizado'
    observacoes: string
    arquivo_planilha: File
    conferente: string
  }>,
) => {
  const formData = new FormData()
  if (data.rota) formData.append('rota', data.rota)
  if (data.data) formData.append('data', data.data)
  if (data.status) formData.append('status', data.status)
  if (data.observacoes !== undefined) formData.append('observacoes', data.observacoes)
  if (data.arquivo_planilha) formData.append('arquivo_planilha', data.arquivo_planilha)
  if (data.conferente !== undefined) formData.append('conferente', data.conferente)

  return pb.collection('romaneios').update<Romaneio>(id, formData)
}

export const deleteRomaneio = async (
  id: string,
  maxRetries = 35,
  timeoutMs = 25000,
): Promise<boolean> => {
  let attempt = 0
  while (attempt < maxRetries) {
    try {
      const deletePromise = pb.collection('romaneios').delete(id)
      let timer: ReturnType<typeof setTimeout> | undefined
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`Timeout ao excluir romaneio ${id} após ${timeoutMs}ms`))
        }, timeoutMs)
      })

      const res = await Promise.race([deletePromise, timeoutPromise])
      if (timer) clearTimeout(timer)
      return res
    } catch (err: any) {
      attempt++
      const status = Number(err?.status || err?.response?.code) || 0
      const msg = String(err?.message || '')
      if (status === 404 || msg.includes('404')) {
        return true // já foi excluído
      }
      if (status === 400 || status === 403) {
        // Erro definitivo do cliente
        throw err
      }
      if (attempt < maxRetries) {
        const rateLimited =
          status === 429 || msg.includes('429') || msg.toLowerCase().includes('too many requests')
        const baseDelay = rateLimited
          ? Math.min(500 * Math.pow(1.35, Math.min(attempt - 1, 8)), 4000)
          : Math.min(200 * attempt, 2000)
        const jitter = Math.floor(Math.random() * 250)
        await new Promise((r) => setTimeout(r, Math.round(baseDelay + jitter)))
        continue
      }
      throw err
    }
  }
  return false
}
