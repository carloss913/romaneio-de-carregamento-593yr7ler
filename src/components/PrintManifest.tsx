import { Romaneio, RomaneioItem } from '@/types/database'
import {
  formatBoxesAndPieces,
  formatProductAmount,
  formatWeight,
  isNonKgProduto,
  isPacoteProduto,
  isUnidadeProduto,
} from '@/lib/conversion'

interface PrintManifestProps {
  romaneio: Romaneio
  itens: RomaneioItem[]
}

export function PrintManifest({ romaneio, itens }: PrintManifestProps) {
  const totalPeso = itens
    .filter((i) => !isNonKgProduto(i.expand?.produto?.unidade_medida))
    .reduce((acc, i) => acc + i.peso_total_kg, 0)
  const totalUnidades = itens
    .filter((i) => isNonKgProduto(i.expand?.produto?.unidade_medida))
    .reduce((acc, i) => acc + i.peso_total_kg, 0)
  const totalCaixas = itens.reduce((acc, i) => acc + i.caixas, 0)
  const totalPecas = itens.reduce((acc, i) => acc + i.pecas, 0)

  const getItemQuantidade = (item: RomaneioItem): string => {
    const prod = item.expand?.produto
    const isPct = isPacoteProduto(prod?.unidade_medida)
    const isUn = isUnidadeProduto(prod?.unidade_medida)

    if (isPct) {
      if (!prod?.pecas_por_caixa || prod.pecas_por_caixa <= 0) {
        return `${formatWeight(item.peso_total_kg)} un`
      }
      return formatBoxesAndPieces(item.caixas, item.pecas, 'pacote')
    }

    if (isUn) {
      if (!prod?.pecas_por_caixa || prod.pecas_por_caixa <= 0) {
        return `${formatWeight(item.peso_total_kg)} un`
      }
      return formatBoxesAndPieces(item.caixas, item.pecas, 'unidade')
    }

    if (!prod?.peso_caixa_kg || prod.peso_caixa_kg <= 0) {
      return `${formatWeight(item.peso_total_kg)} kg`
    }
    return formatBoxesAndPieces(item.caixas, item.pecas, 'kg')
  }

  return (
    <div className="hidden print:block print-manifest-container text-black bg-white">
      {/* Cabeçalho do Romaneio - Apenas na primeira página */}
      <header className="print-header border-b border-black pb-1.5 mb-2">
        <div className="flex justify-between items-start gap-2">
          <div>
            <h1 className="text-base font-black tracking-tight uppercase leading-none">
              Romaneio de Carregamento
            </h1>
            <p className="text-[10px] font-medium text-slate-700 mt-0.5 leading-tight">
              Manifesto de Carga e Conferência • Romaneio #{romaneio.id.slice(-4).toUpperCase()}
            </p>
          </div>
          <div className="text-right flex items-center gap-3">
            <div className="text-right">
              <span className="text-[10px] font-bold uppercase text-slate-600 block leading-none">
                Rota
              </span>
              <span className="text-sm font-black uppercase text-black inline-block leading-tight">
                {romaneio.rota}
              </span>
            </div>
            <div className="text-right border-l border-slate-300 pl-2">
              <span className="text-[10px] font-bold uppercase text-slate-600 block leading-none">
                Data
              </span>
              <span className="text-sm font-bold text-black whitespace-nowrap leading-tight">
                {new Date(romaneio.data).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
              </span>
            </div>
          </div>
        </div>

        {romaneio.observacoes && (
          <div className="mt-1 p-1 border border-slate-300 rounded bg-slate-50 text-[10px] leading-tight">
            <strong className="font-bold">Obs:</strong> {romaneio.observacoes}
          </div>
        )}
      </header>

      {/* Tabela de Itens */}
      <table className="w-full text-left border-collapse print-table text-[12px] leading-tight">
        {/* thead com display: table-row-group para aparecer SOMENTE na 1ª página */}
        <thead className="print-thead-single">
          <tr className="border-b border-black font-bold text-[11px] uppercase bg-slate-100">
            <th className="py-1.5 px-1 text-center w-6">✓</th>
            <th className="py-1.5 px-1 w-14">Cód.</th>
            <th className="hidden print:hidden py-1.5 px-1 w-20">Seção</th>
            <th className="py-1.5 px-1">Descrição do Produto</th>
            <th className="py-1.5 px-1 text-right w-20">Qtd / Peso</th>
            <th className="py-1.5 px-1 text-right w-24">Quantidade</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((item, idx) => {
            const prod = item.expand?.produto
            const secao = prod?.secao || '-'
            const customHeight =
              item.altura_linha && item.altura_linha > 0 ? item.altura_linha : undefined
            return (
              <tr
                key={item.id || idx}
                style={
                  customHeight
                    ? { height: `${customHeight}px`, minHeight: `${customHeight}px` }
                    : undefined
                }
                className={`border-b border-slate-400 print-row ${
                  idx % 2 === 1 ? 'bg-slate-200/80' : 'bg-white'
                }`}
              >
                <td
                  style={customHeight ? { height: `${customHeight}px` } : undefined}
                  className="py-1.5 px-1 text-center align-top font-bold text-[11px]"
                >
                  {item.carregado ? '✓' : '□'}
                </td>
                <td
                  style={customHeight ? { height: `${customHeight}px` } : undefined}
                  className="py-1.5 px-1 text-slate-700 font-mono text-[11px] tabular-nums align-top"
                >
                  {prod?.codigo || '-'}
                </td>
                <td className="hidden print:hidden py-1.5 px-1 text-slate-700 text-[11px] uppercase font-semibold align-top truncate max-w-[80px]">
                  {secao}
                </td>
                <td
                  style={customHeight ? { height: `${customHeight}px` } : undefined}
                  className="py-1.5 px-1 align-top text-[11px]"
                >
                  <div>
                    <span className="font-semibold text-black">{prod?.nome || 'Produto'}</span>
                    {prod?.marca ? (
                      <span className="text-[11px] text-slate-600 font-normal ml-1">
                        ({prod.marca})
                      </span>
                    ) : null}
                  </div>
                  {item.observacao && item.observacao.trim() ? (
                    <div className="text-[10px] text-slate-700 italic mt-0.5 leading-tight">
                      <strong className="font-semibold not-italic">Obs:</strong>{' '}
                      {item.observacao.trim()}
                    </div>
                  ) : null}
                </td>
                <td
                  style={customHeight ? { height: `${customHeight}px` } : undefined}
                  className="py-1.5 px-1 text-right tabular-nums align-top whitespace-nowrap text-[11px]"
                >
                  {formatProductAmount(item.peso_total_kg, prod?.unidade_medida)}
                </td>
                <td
                  style={customHeight ? { height: `${customHeight}px` } : undefined}
                  className="py-1.5 px-1 text-right font-bold text-black align-top whitespace-nowrap text-[11px]"
                >
                  {getItemQuantidade(item)}
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot className="print-tfoot-last">
          <tr className="border-t border-b border-black font-bold bg-slate-100 text-[11px] print-avoid-break">
            <td colSpan={2} className="py-1.5 px-1 uppercase">
              TOTAL: {itens.length} ITENS
            </td>
            <td className="py-1.5 px-1"></td>
            <td className="py-1.5 px-1 text-right tabular-nums whitespace-nowrap">
              {formatWeight(totalPeso)} kg
              {totalUnidades > 0 && (
                <span className="block text-[10px] text-slate-700">
                  +{formatWeight(totalUnidades)} un
                </span>
              )}
            </td>
            <td className="py-1.5 px-1 text-right text-black font-bold text-[11px]">
              {totalCaixas > 0 && `${totalCaixas} cx `}
              {totalPecas > 0 && `${totalPecas} pct`}
            </td>
          </tr>
        </tfoot>
      </table>

      {/* Bloco de Assinaturas e Rodapé */}
      <div className="print-signatures mt-3 pt-2 text-center text-[10px] print-avoid-break">
        <div className="grid grid-cols-2 gap-8">
          <div>
            <p className="font-bold text-slate-900 mb-0.5 min-h-[14px]">
              {romaneio.conferente || ''}
            </p>
            <div className="border-t border-slate-700 pt-0.5 font-semibold">
              Conferente Responsável
            </div>
            <p className="text-[9px] text-slate-500">Assinatura / Carimbo</p>
          </div>
          <div>
            <p className="font-bold text-slate-900 mb-0.5 min-h-[14px]">&nbsp;</p>
            <div className="border-t border-slate-700 pt-0.5 font-semibold">
              Motorista / Transportador
            </div>
            <p className="text-[9px] text-slate-500">Assinatura / RG</p>
          </div>
        </div>
      </div>
    </div>
  )
}
