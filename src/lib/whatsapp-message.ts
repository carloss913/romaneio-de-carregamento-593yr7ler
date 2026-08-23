import { Romaneio, RomaneioItem } from '@/types/database'

export function buildWhatsAppMessage(
  romaneio: Romaneio,
  itens: RomaneioItem[],
  options: { carregadoCount?: number; statusText?: string; conferente?: string } = {},
): string {
  const statusText =
    options.statusText || (romaneio.status === 'finalizado' ? 'Finalizado' : 'Em Andamento')

  const totalPeso = itens.reduce((acc, i) => acc + i.peso_total_kg, 0)

  let msg = `*Conclusão de Carregamento*\n\n`
  if (options.conferente && options.conferente.trim().length > 0) {
    msg += `Conferente: ${options.conferente.trim()}\n`
  }
  msg += `Romaneio: #${romaneio.id.slice(-4).toUpperCase()}\n`
  msg += `Rota: ${romaneio.rota}\n`
  msg += `Data: ${new Date(romaneio.data).toLocaleDateString('pt-BR')}\n`
  msg += `Status: ${statusText}\n`
  msg += `Total: ${totalPeso.toFixed(1)} kg\n`
  msg += `Produtos: ${itens.length}\n`

  if (options.carregadoCount !== undefined) {
    msg += `Itens carregados: ${options.carregadoCount}/${itens.length}\n`
  }

  const itemsWithObs = itens.filter((i) => i.observacao && i.observacao.trim().length > 0)

  if (itemsWithObs.length > 0) {
    msg += `\n*Observações dos Itens:*\n`
    const obsLines = itemsWithObs.map((item) => {
      const code = item.expand?.produto?.codigo || '-'
      const name = item.expand?.produto?.nome || 'Produto'
      return `- Código: ${code} — Produto: ${name} — Obs: ${item.observacao}`
    })
    msg += obsLines.join('\n\n') + '\n'
  }

  if (romaneio.observacoes && romaneio.observacoes.trim().length > 0) {
    msg += `\n*Observações Gerais:*\n${romaneio.observacoes}`
  }

  return msg
}
