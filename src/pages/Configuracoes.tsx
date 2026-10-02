import { useEffect, useState } from 'react'
import { Save, Trash2, AlertTriangle, Clock, Loader2 } from 'lucide-react'
import {
  getAutoDeleteMonths,
  setAutoDeleteMonths,
  AUTO_DELETE_OPTIONS,
} from '@/services/autoDelete'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'

export default function Configuracoes() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [meses, setMeses] = useState<number>(0)

  useEffect(() => {
    let isMounted = true
    getAutoDeleteMonths()
      .then((val) => {
        if (isMounted) {
          setMeses(val)
        }
      })
      .catch((err) => {
        console.error('Erro ao carregar prazo de limpeza automática:', err)
      })
      .finally(() => {
        if (isMounted) {
          setFetching(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await setAutoDeleteMonths(meses)
      toast({
        title: 'Configuração salva!',
        description:
          meses > 0
            ? `Romaneios finalizados há mais de ${meses} meses serão excluídos diariamente pelo servidor.`
            : 'Limpeza automática desativada no servidor.',
      })
    } catch (_) {
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar a configuração.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-800 tracking-tight">Configurações</h1>
        <p className="text-sm text-slate-500 mt-1">
          Ajuste as preferências do sistema de gerenciamento de romaneios.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-orange-500" />
            Limpeza Automática de Romaneios
          </CardTitle>
          <CardDescription>
            Defina por quanto tempo os romaneios finalizados permanecem no sistema antes de serem
            removidos automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Prazo de exclusão</label>
              <Select
                value={String(meses)}
                disabled={fetching || loading}
                onValueChange={(v) => {
                  const val = Number(v)
                  setMeses(val)
                }}
              >
                <SelectTrigger className="bg-white rounded-xl border-slate-200">
                  <SelectValue
                    placeholder={fetching ? 'Carregando configuração...' : 'Selecione o prazo'}
                  />
                </SelectTrigger>
                <SelectContent>
                  {AUTO_DELETE_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={String(opt)}>
                      {opt === 0 ? 'Desativado' : `${opt} meses`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {meses > 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                <p className="text-sm text-slate-600">
                  Romaneios finalizados há mais de{' '}
                  <span className="font-bold text-slate-800">{meses} meses</span> serão excluídos
                  automaticamente.
                </p>
                <p className="text-xs text-slate-400">
                  A limpeza ocorre automaticamente todos os dias às 03:00 (servidor), de forma
                  centralizada para todos os dispositivos.
                </p>
              </div>
            )}

            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-700">
                  Atenção: a exclusão é permanente e não pode ser desfeita.
                </p>
                <p className="text-xs text-red-500 mt-1">
                  Uma vez excluídos, os romaneios e seus itens não poderão ser recuperados.
                </p>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading || fetching}
              className="bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  {meses > 0 ? (
                    <Trash2 className="w-4 h-4 mr-2" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Salvar
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
