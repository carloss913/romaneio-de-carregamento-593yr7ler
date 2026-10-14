import pb from '@/lib/pocketbase/client'
import { Produto } from '@/types/database'

export const getProdutos = (options?: { fields?: string }) =>
  pb.collection('produtos').getFullList<Produto>({
    sort: 'codigo',
    fields: options?.fields,
  })

export const getProduto = (id: string) => pb.collection('produtos').getOne<Produto>(id)

export const createProduto = (data: {
  codigo?: string
  nome: string
  marca?: string
  secao?: string
  unidade_medida?: 'kg' | 'unidade' | 'pacote'
  peso_caixa_kg?: number
  pecas_por_caixa?: number
  peso_peca_kg?: number
  ativo?: boolean
}) => pb.collection('produtos').create<Produto>(data)

export const updateProduto = (
  id: string,
  data: Partial<{
    codigo: string
    nome: string
    marca: string
    secao: string
    unidade_medida: 'kg' | 'unidade' | 'pacote'
    peso_caixa_kg: number
    pecas_por_caixa: number
    peso_peca_kg: number
    ativo: boolean
  }>,
) => pb.collection('produtos').update<Produto>(id, data)

export const deleteProduto = (id: string) => pb.collection('produtos').delete(id)
