import { useEffect, useState, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Truck, ChevronRight, FileText, Scale, CheckCircle2, Package, Plus } from 'lucide-react'
import { Romaneio, RomaneioItem } from '@/types/database'
import { getRomaneios } from '@/services/romaneios'
import { runAutoDelete } from '@/services/autoDelete'
import pb from '@/lib/pocketbase/client'
import { RouteBadge } from '@/components/RouteBadge'
import { Button } from '@/components/ui/button'
import { NovoRomaneioModal } from '@/components/NovoRomaneioModal'
import { useRealtime } from '@/hooks/use-realtime'
import { useRotas } from '@/hooks/use-rotas'

export default function Index() {
  const { rotas } = useRotas()
  const [romaneios, setRomaneios] = useState<Romaneio[]>([])
  const [itens, setItens] = useState<RomaneioItem[]>([])
  const [novoModalOpen, setNovoModalOpen] = useState(false)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadData = useCallback(async () => {
    try {
      const roms = await getRomaneios()
      setRomaneios(roms)
      if (roms.length > 0) {
        const filterStr = roms.map((r) => `romaneio="${r.id}"`).join(' || ')
        const relevantItens = await pb.collection('romaneio_itens').getFullList<RomaneioItem>({
          filter: filterStr,
        })
        setItens(relevantItens)
      } else {
        setItens([])
      }
    } catch (err) {
      console.error('Erro ao carregar dados do painel:', err)
    }
  }, [])

  const debouncedLoadData = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    debounceTimerRef.current = setTimeout(() => {
      loadData()
    }, 500)
  }, [loadData])

  useEffect(() => {
    // Dispara a rotina de exclusão automática de romaneios finalizados
    // antigos conforme o prazo configurado em "Configurações". É fire-and-forget:
    // recarrega a lista em seguida para refletir eventuais remoções.
    runAutoDelete()
      .then((excluidos) => {
        if (excluidos > 0) loadData()
      })
      .catch((err) => console.error('Auto-delete falhou:', err))
    loadData()

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [loadData])

  useRealtime('romaneios', debouncedLoadData)
  useRealtime('romaneio_itens', debouncedLoadData)

  const todayStr = new Date().toISOString().split('T')[0]
  const romaneiosHoje = romaneios.filter((r) => r.data.startsWith(todayStr))

  const totalKgHoje = itens
    .filter((i) => romaneiosHoje.some((r) => r.id === i.romaneio))
    .reduce((acc, i) => acc + i.peso_total_kg, 0)

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Bom dia'
    if (hour < 18) return 'Boa tarde'
    return 'Boa noite'
  }

  return (
    <div className="space-y-8">
      {/* Header Greeting */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">
            {getGreeting()}, Operador! 👋
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Selecione uma rota para gerenciar os carregamentos de caminhões hoje.
          </p>
        </div>
        <Button
          onClick={() => setNovoModalOpen(true)}
          className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-5 rounded-xl shadow-md shadow-orange-500/20"
        >
          <Plus className="w-4 h-4 mr-2" /> Novo Romaneio
        </Button>
      </div>

      {/* Route Cards Grid (dynamic from the rotas collection) */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Rotas de Carregamento
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {rotas
            .filter((r) => r.ativa)
            .map((r) => {
              const romsDaRota = romaneiosHoje.filter((rom) => rom.rota === r.nome)
              const kgDaRota = itens
                .filter((i) => romsDaRota.some((rom) => rom.id === i.romaneio))
                .reduce((acc, i) => acc + i.peso_total_kg, 0)

              return (
                <Link
                  key={r.id}
                  to={`/rotas/${encodeURIComponent(r.nome)}`}
                  className="group relative bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between overflow-hidden"
                >
                  {/* Top Accent Line */}
                  <div
                    className="absolute top-0 left-0 right-0 h-1.5 transition-all group-hover:h-2"
                    style={{ backgroundColor: r.cor || '#78716c' }}
                  />

                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-sm"
                        style={{ backgroundColor: r.cor || '#78716c' }}
                      >
                        <Truck className="w-5 h-5" />
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-700 group-hover:translate-x-1 transition-all" />
                    </div>

                    <h3 className="text-lg font-black text-slate-800 tracking-tight">{r.nome}</h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      {romsDaRota.length} {romsDaRota.length === 1 ? 'romaneio' : 'romaneios'} hoje
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-400">Carga total:</span>
                    <span className="text-sm font-bold text-slate-800 tabular-nums">
                      {kgDaRota.toFixed(1)} kg
                    </span>
                  </div>
                </Link>
              )
            })}
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Romaneios Hoje</p>
            <p className="text-xl font-black text-slate-800">{romaneiosHoje.length}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center font-bold">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Peso Total Hoje</p>
            <p className="text-xl font-black text-slate-800 tabular-nums">
              {totalKgHoje.toFixed(0)} kg
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Finalizados Hoje</p>
            <p className="text-xl font-black text-slate-800">
              {romaneiosHoje.filter((r) => r.status === 'finalizado').length}
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Total de Itens</p>
            <p className="text-xl font-black text-slate-800">{itens.length}</p>
          </div>
        </div>
      </div>

      {/* Recent Romaneios List */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800">Últimos Romaneios Abertos</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setNovoModalOpen(true)}
            className="text-orange-600 text-xs font-semibold"
          >
            + Novo Romaneio
          </Button>
        </div>

        {romaneios.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-sm">
            Nenhum romaneio cadastrado ainda. Clique em "Novo Romaneio" para iniciar.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {romaneios.slice(0, 5).map((rom) => {
              const romItens = itens.filter((i) => i.romaneio === rom.id)
              const pesoRom = romItens.reduce((a, b) => a + b.peso_total_kg, 0)
              const cxRom = romItens.reduce((a, b) => a + b.caixas, 0)

              return (
                <Link
                  key={rom.id}
                  to={`/romaneios/${rom.id}`}
                  className="py-3 flex items-center justify-between hover:bg-slate-50 px-2 rounded-xl transition-all"
                >
                  <div className="flex items-center gap-3">
                    <RouteBadge rota={rom.rota} />
                    <div>
                      <p className="text-sm font-bold text-slate-800">
                        Romaneio #{rom.id.slice(-4).toUpperCase()}
                      </p>
                      <p className="text-xs text-slate-400">
                        {new Date(rom.data).toLocaleDateString('pt-BR', { timeZone: 'UTC' })} •{' '}
                        {romItens.length} produtos
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <p className="text-sm font-bold text-slate-800 tabular-nums">
                        {pesoRom.toFixed(1)} kg
                      </p>
                      <p className="text-xs text-slate-500 font-medium">{cxRom} caixas</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      <NovoRomaneioModal open={novoModalOpen} onOpenChange={setNovoModalOpen} />
    </div>
  )
}
