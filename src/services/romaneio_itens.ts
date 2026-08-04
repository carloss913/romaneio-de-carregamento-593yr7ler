import pb from '@/lib/pocketbase/client'
import { RomaneioItem } from '@/types/database'

export const getRomaneioItens = (romaneioId: string) =>
  pb.collection('romaneio_itens').getFullList<RomaneioItem>({
    filter: `romaneio = "${romaneioId}"`,
    expand: 'produto',
    sort: 'created',
  })

export const createRomaneioItem = (data: {
  romaneio: string
  produto: string
  peso_total_kg: number
  caixas: number
  pecas: number
}) => pb.collection('romaneio_itens').create<RomaneioItem>(data)

export const updateRomaneioItem = (
  id: string,
  data: Partial<{
    peso_total_kg: number
    caixas: number
    pecas: number
    carregado: boolean
  }>,
) => pb.collection('romaneio_itens').update<RomaneioItem>(id, data)

export const deleteRomaneioItem = (id: string) => pb.collection('romaneio_itens').delete(id)

export const deleteItensByRomaneio = async (romaneioId: string) => {
  const itens = await getRomaneioItens(romaneioId)
  await Promise.all(itens.map((item) => deleteRomaneioItem(item.id)))
}
