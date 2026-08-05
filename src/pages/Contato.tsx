import { useState, useEffect } from 'react'
import { Phone, User, Save, MessageCircle, AlertCircle } from 'lucide-react'
import { getConfiguracoes, saveConfiguracoes } from '@/services/configuracoes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { extractFieldErrors, getErrorMessage, type FieldErrors } from '@/lib/pocketbase/errors'

export default function Contato() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [telefone, setTelefone] = useState('')
  const [nome, setNome] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  useEffect(() => {
    getConfiguracoes().then((config) => {
      setTelefone(config?.telefone_contato || '')
      setNome(config?.nome_contato || '')
    })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFieldErrors({})
    setLoading(true)
    try {
      await saveConfiguracoes({
        telefone_contato: telefone,
        nome_contato: nome,
      })
      toast({ title: 'Contato salvo com sucesso!' })
    } catch (err) {
      setFieldErrors(extractFieldErrors(err))
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
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-800 tracking-tight">Contato</h1>
        <p className="text-sm text-slate-500 mt-1">
          Cadastre o número de WhatsApp que receberá a conclusão dos romaneios.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-green-600" />
            Contato de Recebimento
          </CardTitle>
          <CardDescription>
            O número cadastrado aqui será usado no botão "Enviar conclusão via WhatsApp" nos
            romaneios.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="telefone" className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                Número do WhatsApp (com DDD)
              </Label>
              <Input
                id="telefone"
                type="tel"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="Ex: 5594999999999"
                className={fieldErrors.telefone_contato ? 'border-red-500' : ''}
              />
              {fieldErrors.telefone_contato ? (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {fieldErrors.telefone_contato}
                </p>
              ) : (
                <p className="text-xs text-slate-400">
                  Informe o número com código do país e DDD (ex: 5594999999999)
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="nome" className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400" />
                Nome do Destinatário (opcional)
              </Label>
              <Input
                id="nome"
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Conferência de Carga"
                className={fieldErrors.nome_contato ? 'border-red-500' : ''}
              />
              {fieldErrors.nome_contato && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {fieldErrors.nome_contato}
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl"
            >
              <Save className="w-4 h-4 mr-2" />
              {loading ? 'Salvando...' : 'Salvar Contato'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
