import pb from '@/lib/pocketbase/client'
import { RomaneioItem, Produto } from '@/types/database'
import { convertWeightToBoxesAndPieces } from '@/lib/conversion'

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
  observacao?: string
}) => pb.collection('romaneio_itens').create<RomaneioItem>(data)

export const updateRomaneioItem = (
  id: string,
  data: Partial<{
    peso_total_kg: number
    caixas: number
    pecas: number
    carregado: boolean
    observacao: string
    altura_linha: number | null
  }>,
) => pb.collection('romaneio_itens').update<RomaneioItem>(id, data)

export const deleteRomaneioItem = (id: string) => pb.collection('romaneio_itens').delete(id)

export const deleteItensByRomaneio = async (romaneioId: string) => {
  const itens = await getRomaneioItens(romaneioId)
  // Deletar sequencialmente com delay para evitar 429
  for (let i = 0; i < itens.length; i++) {
    try {
      await deleteRomaneioItem(itens[i].id)
    } catch (err) {
      console.error(`Erro ao deletar item ${itens[i].id}:`, err)
    }
    if (i < itens.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 150))
    }
  }
}

export const refreshRomaneioItens = async (
  itens: RomaneioItem[],
  produtos: Produto[],
): Promise<number> => {
  let updatedCount = 0
  for (const item of itens) {
    const produto = produtos.find((p) => p.id === item.produto)
    if (!produto) continue

    let needsUpdate = false
    let newCaixas = item.caixas
    let newPecas = item.pecas

    if (produto.unidade_medida === 'unidade' || produto.unidade_medida === 'pacote') {
      if (item.peso_total_kg > 0) {
        const upc = Math.round(produto.pecas_por_caixa ?? 0)
        let calcCx = 0
        let calcPc = 0
        if (upc > 0) {
          calcCx = Math.floor(item.peso_total_kg / upc)
          calcPc = Math.round(item.peso_total_kg % upc)
        } else {
          calcCx = 0
          calcPc = Math.round(item.peso_total_kg)
        }
        if (calcCx !== item.caixas || calcPc !== item.pecas) {
          newCaixas = calcCx
          newPecas = calcPc
          needsUpdate = true
        }
      }
    } else if (produto.peso_caixa_kg && produto.peso_caixa_kg > 0 && item.peso_total_kg > 0) {
      const conv = convertWeightToBoxesAndPieces(
        item.peso_total_kg,
        produto.peso_caixa_kg,
        produto.peso_peca_kg,
        produto.pecas_por_caixa,
      )
      newCaixas = conv.caixas
      newPecas = conv.pecas
      if (newCaixas !== item.caixas || newPecas !== item.pecas) {
        needsUpdate = true
      }
    }

    if (needsUpdate) {
      await updateRomaneioItem(item.id, {
        caixas: newCaixas,
        pecas: newPecas,
      })
      updatedCount++
    }
  }
  return updatedCount
}
