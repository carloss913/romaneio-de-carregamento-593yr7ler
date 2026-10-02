import pb from '@/lib/pocketbase/client'
import { Configuracoes } from '@/types/database'

export const getConfiguracoes = async (): Promise<Configuracoes | null> => {
  try {
    const list = await pb.collection('configuracoes').getFullList<Configuracoes>({
      sort: '-created',
    })
    return list[0] || null
  } catch {
    return null
  }
}

export const saveConfiguracoes = (data: {
  telefone_whatsapp?: string
  nome_destinatario?: string
  telefone_contato?: string
  nome_contato?: string
  auto_delete_months?: number
}) =>
  getConfiguracoes().then((existing) => {
    if (existing) {
      return pb.collection('configuracoes').update<Configuracoes>(existing.id, data)
    }
    return pb.collection('configuracoes').create<Configuracoes>(data)
  })
