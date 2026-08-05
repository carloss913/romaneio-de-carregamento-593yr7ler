import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { getConfiguracoes, saveConfiguracoes } from '@/services/configuracoes'
import { useToast } from '@/hooks/use-toast'
import { getErrorMessage } from '@/lib/pocketbase/errors'

interface ConfigPhoneModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function ConfigPhoneModal({ open, onOpenChange, onSuccess }: ConfigPhoneModalProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [telefone, setTelefone] = useState('')
  const [nome, setNome] = useState('')

  useEffect(() => {
    if (open) {
      getConfiguracoes().then((config) => {
        setTelefone(config?.telefone_whatsapp || '')
        setNome(config?.nome_destinatario || '')
      })
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await saveConfiguracoes({ telefone_whatsapp: telefone, nome_destinatario: nome })
      toast({ title: 'Configuração salva!' })
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      toast({
        title: 'Erro ao salvar',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Telefone para Envio de Conclusões</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Número do WhatsApp (com DDD)</Label>
            <Input
              type="tel"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="Ex: 5594999999999"
              required
            />
            <p className="text-xs text-slate-400">
              Informe o número com código do país e DDD (ex: 5594999999999)
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Nome do Destinatário (opcional)</Label>
            <Input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Conferência de Carga"
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
              {loading ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
