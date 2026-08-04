import { RotaType, ROTAS } from '@/types/database'
import { cn } from '@/lib/utils'

export function RouteBadge({ rota, className }: { rota: RotaType; className?: string }) {
  const config = ROTAS.find((r) => r.name === rota) || ROTAS[4]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border',
        config.bg,
        config.text,
        config.border,
        className,
      )}
    >
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: config.color }} />
      {rota}
    </span>
  )
}
