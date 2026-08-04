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
}) => {
  const formData = new FormData()
  formData.append('rota', data.rota)
  formData.append('data', data.data)
  formData.append('status', data.status || 'em_andamento')
  if (data.observacoes) formData.append('observacoes', data.observacoes)
  if (data.arquivo_planilha) formData.append('arquivo_planilha', data.arquivo_planilha)

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
  }>,
) => {
  const formData = new FormData()
  if (data.rota) formData.append('rota', data.rota)
  if (data.data) formData.append('data', data.data)
  if (data.status) formData.append('status', data.status)
  if (data.observacoes !== undefined) formData.append('observacoes', data.observacoes)
  if (data.arquivo_planilha) formData.append('arquivo_planilha', data.arquivo_planilha)

  return pb.collection('romaneios').update<Romaneio>(id, formData)
}

export const deleteRomaneio = (id: string) => pb.collection('romaneios').delete(id)
