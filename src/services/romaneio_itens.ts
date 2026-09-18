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
  if (err && typeof err === 'object' && 'status' in err) {
    return (err as { status: unknown }).status === 429
  }
  return false
}

export const isPermanentClientError = (err: unknown): boolean => {
  // 400 (dados inválidos), 403 (permissão negada) são definitivos.
  // 404 não é erro na exclusão (já não existe).
  // 429, 500, 502, 503, 504 ou 0 (rede/timeout) são transitórios.
  let status = 0
  if (err && typeof err === 'object' && 'status' in err) {
    status = Number((err as { status: unknown }).status) || 0
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

export const deleteRomaneioItem = async (id: string, maxRetries = 25): Promise<boolean> => {
  let attempt = 0
  while (attempt < maxRetries) {
    try {
      return await pb.collection('romaneio_itens').delete(id)
    } catch (err: any) {
      attempt++
      if (isNotFoundError(err)) {
        return true // já foi excluído
      }
      if (isPermanentClientError(err)) {
        console.warn(`[deleteRomaneioItem] Erro definitivo ao excluir item ${id}:`, err)
        throw err
      }
      if (attempt < maxRetries) {
        const rateLimited = isTooManyRequests(err)
        const baseDelay = rateLimited
          ? Math.min(250 * Math.pow(1.3, Math.min(attempt - 1, 6)), 2000)
          : Math.min(150 * attempt, 1500)
        const jitter = Math.floor(Math.random() * 100)
        await new Promise((r) => setTimeout(r, Math.round(baseDelay + jitter)))
        continue
      }
      throw err
    }
  }
  return false
}

/**
 * Exclusão veloz e adaptativa dos itens de um romaneio.
 * Inicia com concorrência agressiva (~10 a 12 exclusões simultâneas),
 * ZERO pausas artificiais entre exclusões.
 * Se ocorrer 429/erro transitório, reduz concorrência com cooling curto e retry persistente,
 * aumentando novamente após sucessos consecutivos.
 * Em caso de erro definitivo (400, 403 ou esgotamento de retries), aborta e lança exceção.
 */
export const deleteItensByRomaneio = async (
  romaneioId: string,
  options?: {
    initialConcurrency?: number
    minConcurrency?: number
    maxConcurrency?: number
    coolingOn429Ms?: number
  },
) => {
  let itens: RomaneioItem[] = []
  try {
    itens = await getRomaneioItens(romaneioId)
  } catch (err: any) {
    if (isNotFoundError(err)) return
    console.warn(`Erro ao listar itens para exclusão do romaneio ${romaneioId}:`, err)
    throw err
  }
  if (!itens || itens.length === 0) return

  const minC = options?.minConcurrency ?? 2
  const maxC = options?.maxConcurrency ?? 12
  const initialC = Math.min(Math.max(options?.initialConcurrency ?? 12, minC), maxC)
  const coolingMs = options?.coolingOn429Ms ?? 300

  let currentConcurrency = initialC
  let consecutiveSuccesses = 0
  let pauseUntil = 0
  let fatalError: any = null

  let nextIndex = 0

  const waitIfCooling = async () => {
    const now = Date.now()
    if (pauseUntil > now) {
      await new Promise((r) => setTimeout(r, pauseUntil - now))
    }
  }

  const runWorker = async (workerId: number) => {
    while (true) {
      if (fatalError || nextIndex >= itens.length) {
        return
      }

      if (workerId > currentConcurrency) {
        await new Promise((r) => setTimeout(r, 40))
        if (fatalError || nextIndex >= itens.length) {
          return
        }
        continue
      }

      await waitIfCooling()

      if (fatalError || nextIndex >= itens.length) {
        return
      }

      const currentIndex = nextIndex++
      if (currentIndex >= itens.length) {
        return
      }

      const item = itens[currentIndex]

      try {
        await deleteRomaneioItem(item.id)

        // Sucesso: sobe concorrência progressivamente se estiver abaixo do teto
        consecutiveSuccesses++
        if (consecutiveSuccesses >= 10 && currentConcurrency < maxC) {
          currentConcurrency = Math.min(currentConcurrency + 1, maxC)
          consecutiveSuccesses = 0
        }
      } catch (err: any) {
        if (isNotFoundError(err)) {
          // Já não existe, ignora e segue
          continue
        }

        if (isTooManyRequests(err)) {
          // 429: Reduz concorrência pela metade e aplica cooling curto
          currentConcurrency = Math.max(minC, Math.floor(currentConcurrency / 2))
          consecutiveSuccesses = 0
          const now = Date.now()
          pauseUntil = Math.max(pauseUntil, now + coolingMs)
          await new Promise((r) => setTimeout(r, coolingMs))
          // Tenta novamente este mesmo item que falhou
          try {
            await deleteRomaneioItem(item.id)
          } catch (retryErr: any) {
            if (!isNotFoundError(retryErr)) {
              fatalError = retryErr
              throw retryErr
            }
          }
        } else if (isPermanentClientError(err)) {
          fatalError = err
          throw err
        } else {
          // Erro transitório que não foi recuperado pelo deleteRomaneioItem
          fatalError = err
          throw err
        }
      }
    }
  }

  const workerCount = Math.min(maxC, itens.length)
  const workers = Array.from({ length: workerCount }, (_, i) => runWorker(i + 1))
  await Promise.all(workers)

  if (fatalError) {
    throw fatalError
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
