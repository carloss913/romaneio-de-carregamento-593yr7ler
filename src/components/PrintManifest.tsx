import { Romaneio, RomaneioItem } from '@/types/database'
import { RouteBadge } from './RouteBadge'

interface PrintManifestProps {
  romaneio: Romaneio
  itens: RomaneioItem[]
}

export function PrintManifest({ romaneio, itens }: PrintManifestProps) {
  const totalPeso = itens.reduce((acc, i) => acc + i.peso_total_kg, 0)
  const totalCaixas = itens.reduce((acc, i) => acc + i.caixas, 0)
  const totalPecas = itens.reduce((acc, i) => acc + i.pecas, 0)

  return (
    <div className="hidden print:block p-8 bg-white text-black font-sans">
      {/* Header */}
      <div className="flex justify-between items-center border-b-2 border-slate-900 pb-4 mb-6">
        <div>
          <h1 className="text-2xl font-black tracking-tight uppercase">Catálogo de Carregamento</h1>
          <p className="text-sm font-semibold text-slate-600">
            Manifesto de Carga e Conferência de Frigorífico
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase font-bold text-slate-500">Rota de Entrega</p>
          <div className="text-lg font-bold">
            <RouteBadge rota={romaneio.rota} />
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Data: {new Date(romaneio.data).toLocaleDateString('pt-BR')}
          </p>
        </div>
      </div>

      {romaneio.observacoes && (
        <div className="mb-6 p-3 border rounded bg-slate-50 text-xs">
          <strong>Observações do Romaneio:</strong> {romaneio.observacoes}
        </div>
      )}

      {/* Table */}
      <table className="w-full text-left border-collapse mb-8 text-sm">
        <thead>
          <tr className="border-b-2 border-slate-800">
            <th className="py-2">Item / Produto</th>
            <th className="py-2 text-right">Peso Total (kg)</th>
            <th className="py-2 text-center">Caixas</th>
            <th className="py-2 text-center">Peças Avulsas</th>
            <th className="py-2 text-right">Resultado</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((item, idx) => (
            <tr key={item.id} className="border-b border-slate-200">
              <td className="py-2 font-medium">{item.expand?.produto?.nome || 'Produto'}</td>
              <td className="py-2 text-right tabular-nums">{item.peso_total_kg.toFixed(1)} kg</td>
              <td className="py-2 text-center tabular-nums">{item.caixas} cx</td>
              <td className="py-2 text-center tabular-nums">{item.pecas} pct</td>
              <td className="py-2 text-right font-bold">
                {item.caixas > 0 && `${item.caixas} cx`}
                {item.caixas > 0 && item.pecas > 0 && ' + '}
                {item.pecas > 0 && `${item.pecas} pct`}
                {item.caixas === 0 && item.pecas === 0 && '0 cx'}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-900 font-bold bg-slate-50">
            <td className="py-3">TOTAL DA CARGA</td>
            <td className="py-3 text-right tabular-nums">{totalPeso.toFixed(1)} kg</td>
            <td className="py-3 text-center tabular-nums">{totalCaixas} cx</td>
            <td className="py-3 text-center tabular-nums">{totalPecas} pct</td>
            <td className="py-3 text-right">{itens.length} produtos</td>
          </tr>
        </tfoot>
      </table>

      {/* Signatures */}
      <div className="grid grid-cols-2 gap-12 mt-16 text-center text-xs">
        <div>
          <div className="border-t border-slate-800 pt-2 font-semibold">Conferente Responsável</div>
          <p className="text-slate-400 mt-1">Assinatura e Carimbo</p>
        </div>
        <div>
          <div className="border-t border-slate-800 pt-2 font-semibold">
            Motorista / Transportador
          </div>
          <p className="text-slate-400 mt-1">Assinatura e RG</p>
        </div>
      </div>
    </div>
  )
}
