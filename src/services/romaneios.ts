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

export const deleteRomaneio = async (id: string, maxRetries = 3): Promise<boolean> => {
  let attempt = 0
  while (attempt < maxRetries) {
    try {
      return await pb.collection('romaneios').delete(id)
    } catch (err: any) {
      attempt++
      if (err?.status === 404 || err?.response?.code === 404) {
        return true // já foi excluído
      }
      if (attempt < maxRetries) {
        const delay = (err?.status === 429 ? 400 : 200) * attempt
        await new Promise((r) => setTimeout(r, delay))
        continue
      }
      throw err
    }
  }
  return false
}
