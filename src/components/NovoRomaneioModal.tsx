import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { RotaType, ROTAS } from '@/types/database'
import { createRomaneio } from '@/services/romaneios'
import { useToast } from '@/hooks/use-toast'
import { getErrorMessage } from '@/lib/pocketbase/errors'

interface NovoRomaneioModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultRota?: RotaType
}

export function NovoRomaneioModal({ open, onOpenChange, defaultRota }: NovoRomaneioModalProps) {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [rota, setRota] = useState<RotaType>(defaultRota || 'Piçarra')
  const [data, setData] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate(),
    ).padStart(2, '0')}`
  })
  const [observacoes, setObservacoes] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const romaneio = await createRomaneio({
        rota,
        data: `${data} 00:00:00.000Z`,
        status: 'em_andamento',
        observacoes,
      })
      toast({ title: 'Romaneio criado!', description: `Romaneio da rota ${rota} aberto.` })
      onOpenChange(false)
      navigate(`/romaneios/${romaneio.id}`)
    } catch (err) {
      toast({
        title: 'Erro ao criar romaneio',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Abrir Novo Romaneio de Carga</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="rota">Selecione a Rota</Label>
            <Select value={rota} onValueChange={(val) => setRota(val as RotaType)}>
              <SelectTrigger id="rota">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {ROTAS.map((r) => (
                  <SelectItem key={r.name} value={r.name}>
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: r.color }}
                      />
                      <span>{r.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="data">Data de Carregamento</Label>
            <Input
              id="data"
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="observacoes">Observações / Instruções do Motorista</Label>
            <Textarea
              id="observacoes"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ex: Placa do caminhão, observações de temperatura..."
              rows={3}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {loading ? 'Criando...' : 'Abrir Romaneio'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
