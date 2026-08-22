import { RotaType, stringToColor } from '@/types/database'
import { useRotas } from '@/hooks/use-rotas'
import { cn } from '@/lib/utils'

export function RouteBadge({ rota, className }: { rota: RotaType; className?: string }) {
  const { rotas } = useRotas()
  const found = rotas.find((r) => r.nome === rota)
  const color = found?.cor || stringToColor(rota || '')

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border',
        className,
      )}
      style={{ backgroundColor: color + '1a', borderColor: color, color }}
    >
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      {rota}
    </span>
  )
}
