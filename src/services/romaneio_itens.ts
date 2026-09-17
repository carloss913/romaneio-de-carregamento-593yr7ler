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
  obs_acrescimo?: string
}) => pb.collection('romaneio_itens').create<RomaneioItem>(data)

export const updateRomaneioItem = (
  id: string,
  data: Partial<{
    peso_total_kg: number
    caixas: number
    pecas: number
    carregado: boolean
    observacao: string
    obs_acrescimo: string
    altura_linha: number | null
  }>,
) => pb.collection('romaneio_itens').update<RomaneioItem>(id, data)

export const deleteRomaneioItem = (id: string) => pb.collection('romaneio_itens').delete(id)

export const deleteItensByRomaneio = async (romaneioId: string) => {
  const itens = await getRomaneioItens(romaneioId)
  if (itens.length === 0) return

  // Deletar em pequenos lotes com concorrência controlada
  const BATCH_SIZE = 5
  for (let i = 0; i < itens.length; i += BATCH_SIZE) {
    const batch = itens.slice(i, i + BATCH_SIZE)
    await Promise.all(
      batch.map(async (item) => {
        try {
          await deleteRomaneioItem(item.id)
        } catch (err) {
          console.error(`Erro ao deletar item ${item.id}:`, err)
        }
      }),
    )
  }
}

export const refreshRomaneioItens = async (
  itens: RomaneioItem[],
  produtos: Produto[],
): Promise<number> => {
  const produtoMap = new Map<string, Produto>()
  for (const p of produtos) {
    produtoMap.set(p.id, p)
  }

  const itemsToUpdate: { id: string; caixas: number; pecas: number }[] = []

  for (const item of itens) {
    const produto = produtoMap.get(item.produto)
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
      itemsToUpdate.push({
        id: item.id,
        caixas: newCaixas,
        pecas: newPecas,
      })
    }
  }

  if (itemsToUpdate.length === 0) {
    return 0
  }

  // Executa os updates necessários em paralelo com controle de concorrência
  let updatedCount = 0
  const BATCH_SIZE = 5
  for (let i = 0; i < itemsToUpdate.length; i += BATCH_SIZE) {
    const batch = itemsToUpdate.slice(i, i + BATCH_SIZE)
    await Promise.all(
      batch.map(async (u) => {
        try {
          await updateRomaneioItem(u.id, {
            caixas: u.caixas,
            pecas: u.pecas,
          })
          updatedCount++
        } catch (err) {
          console.error(`Erro ao atualizar item ${u.id}:`, err)
        }
      }),
    )
  }

  return updatedCount
}
