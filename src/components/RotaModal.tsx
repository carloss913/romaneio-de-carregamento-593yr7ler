import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Rota } from '@/types/database'
import { createRota, updateRota } from '@/services/rotas'
import { useToast } from '@/hooks/use-toast'
import { getErrorMessage } from '@/lib/pocketbase/errors'

interface RotaModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  rota?: Rota | null
  defaultOrdem?: number
  onSuccess?: () => void
}

export function RotaModal({ open, onOpenChange, rota, defaultOrdem, onSuccess }: RotaModalProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [nome, setNome] = useState('')
  const [cor, setCor] = useState('#3b82f6')
  const [ordem, setOrdem] = useState<number>(1)
  const [ativa, setAtiva] = useState(true)

  useEffect(() => {
    if (open) {
      setNome(rota?.nome || '')
      setCor(rota?.cor || '#3b82f6')
      setOrdem(rota?.ordem ?? defaultOrdem ?? 1)
      setAtiva(rota?.ativa ?? true)
    }
  }, [open, rota, defaultOrdem])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim()) return
    setLoading(true)
    try {
      const payload = {
        nome: nome.trim(),
        cor,
        ativa,
        ordem: Number(ordem) || 0,
      }
      if (rota) {
        await updateRota(rota.id, payload)
        toast({ title: 'Rota atualizada!' })
      } else {
        await createRota(payload)
        toast({ title: 'Rota criada!' })
      }
      onOpenChange(false)
      onSuccess?.()
    } catch (err) {
      toast({
        title: 'Erro ao salvar rota',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{rota ? 'Editar Rota' : 'Nova Rota'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="nome">Nome da Rota</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Xinguara"
              required
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label>Cor</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={cor}
                onChange={(e) => setCor(e.target.value)}
                className="w-10 h-10 rounded-lg cursor-pointer border border-slate-200 bg-white p-0.5"
                aria-label="Cor da rota"
              />
              <Input
                value={cor}
                onChange={(e) => setCor(e.target.value)}
                placeholder="#3b82f6"
                className="flex-1"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ordem">Ordem (menor aparece primeiro)</Label>
            <Input
              id="ordem"
              type="number"
              min="0"
              value={ordem}
              onChange={(e) => setOrdem(e.target.value === '' ? 0 : Number(e.target.value))}
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={ativa} onCheckedChange={(v) => setAtiva(!!v)} />
            <span className="text-sm text-slate-700">
              Rota ativa (visível no menu e nos romaneios)
            </span>
          </label>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {loading ? 'Salvando...' : rota ? 'Salvar Alterações' : 'Criar Rota'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
