import pb from '@/lib/pocketbase/client'
import { Rota } from '@/types/database'

export const getRotas = () => pb.collection('rotas').getFullList<Rota>({ sort: 'ordem,nome' })

export const getRota = (id: string) => pb.collection('rotas').getOne<Rota>(id)

export const createRota = (data: { nome: string; cor?: string; ativa?: boolean; ordem?: number }) =>
  pb.collection('rotas').create<Rota>(data)

export const updateRota = (
  id: string,
  data: Partial<{ nome: string; cor: string; ativa: boolean; ordem: number }>,
) => pb.collection('rotas').update<Rota>(id, data)

export const deleteRota = (id: string) => pb.collection('rotas').delete(id)
