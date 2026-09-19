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

// Helpers para classificação de erros HTTP / PocketBase
export const isTooManyRequests = (err: unknown): boolean => {
  if (err && typeof err === 'object') {
    const status = (err as any).status || (err as any).response?.code
    if (status === 429) return true
    const msg = String((err as any).message || '')
    if (msg.includes('429') || msg.toLowerCase().includes('too many requests')) return true
  }
  return false
}

export const isPermanentClientError = (err: unknown): boolean => {
  // 400 (dados inválidos), 403 (permissão negada) são definitivos.
  // 404 não é erro na exclusão (já não existe).
  // 429, 500, 502, 503, 504 ou 0 (rede/timeout) são transitórios.
  let status = 0
  if (err && typeof err === 'object') {
    status = Number((err as any).status || (err as any).response?.code) || 0
  }
  return status === 400 || status === 403
}

export const isNotFoundError = (err: unknown): boolean => {
  if (err && typeof err === 'object') {
    const status = (err as any).status || (err as any).response?.code
    if (status === 404) return true
    const msg = String((err as any).message || '')
    if (msg.includes('404')) return true
  }
  return false
}

export const deleteRomaneioItem = async (
  id: string,
  maxRetries = 35,
  timeoutMs = 25000,
): Promise<boolean> => {
  let attempt = 0
  while (attempt < maxRetries) {
    try {
      // Timeout defensivo de 25s por tentativa para não pendurar requisição eternamente
      const deletePromise = pb.collection('romaneio_itens').delete(id)
      let timer: ReturnType<typeof setTimeout> | undefined
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`Timeout ao excluir item ${id} após ${timeoutMs}ms`))
        }, timeoutMs)
      })

      const res = await Promise.race([deletePromise, timeoutPromise])
      if (timer) clearTimeout(timer)
      return res
    } catch (err: any) {
      attempt++
      if (isNotFoundError(err)) {
        return true // já foi excluído com sucesso
      }
      if (isPermanentClientError(err)) {
        console.warn(`[deleteRomaneioItem] Erro definitivo ao excluir item ${id}:`, err)
        throw err
      }

      // Se for 429 ou transitório, nunca aborta enquanto houver tentativas
      if (attempt < maxRetries) {
        const rateLimited = isTooManyRequests(err)
        // Backoff exponencial com jitter (~500ms a ~4000ms para 429)
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

export interface DeleteItensResult {
  total: number
  deleted: number
  failedItens: { id: string; nome?: string; error: string }[]
}

/**
 * Exclusão com concorrência CONSTANTE baixa (3 a 4 trabalhadores simultâneos),
 * evitando rajadas que disparam rate limit 429 no PocketBase.
 * 429 nunca aborta: faz retry persistente com backoff exponencial + jitter.
 * Se houver falha definitiva em itens específicos, retorna o relatório honesto
 * sem apagar o romaneio pai.
 */
export const deleteItensByRomaneio = async (
  romaneioId: string,
  options?: {
    concurrency?: number
    maxRetriesPerItem?: number
  },
): Promise<DeleteItensResult> => {
  let itens: RomaneioItem[] = []
  try {
    itens = await getRomaneioItens(romaneioId)
  } catch (err: any) {
    if (isNotFoundError(err)) {
      return { total: 0, deleted: 0, failedItens: [] }
    }
    console.warn(`Erro ao listar itens para exclusão do romaneio ${romaneioId}:`, err)
    throw err
  }
  if (!itens || itens.length === 0) {
    return { total: 0, deleted: 0, failedItens: [] }
  }

  // Concorrência CONSTANTE de 3 conexões simultâneas (máximo seguro de 4)
  const concurrency = Math.min(Math.max(options?.concurrency ?? 3, 1), 4)
  const maxRetries = options?.maxRetriesPerItem ?? 35

  const failedItens: { id: string; nome?: string; error: string }[] = []
  let deletedCount = 0
  let nextIndex = 0

  const runWorker = async () => {
    while (true) {
      const currentIndex = nextIndex++
      if (currentIndex >= itens.length) {
        return
      }

      const item = itens[currentIndex]
      try {
        await deleteRomaneioItem(item.id, maxRetries)
        deletedCount++
      } catch (err: any) {
        if (isNotFoundError(err)) {
          deletedCount++
          continue
        }
        const errorMsg = String(err?.message || err || 'Erro desconhecido')
        console.error(`[deleteItensByRomaneio] Falha ao excluir item ${item.id}:`, err)
        failedItens.push({
          id: item.id,
          nome: item.expand?.produto?.nome,
          error: errorMsg,
        })
      }
    }
  }

  const workerCount = Math.min(concurrency, itens.length)
  const workers = Array.from({ length: workerCount }, () => runWorker())
  await Promise.all(workers)

  return {
    total: itens.length,
    deleted: deletedCount,
    failedItens,
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
