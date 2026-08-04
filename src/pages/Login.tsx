import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Truck, ArrowRight, Lock, Mail } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { getErrorMessage } from '@/lib/pocketbase/errors'

export default function Login() {
  const navigate = useNavigate()
  const { signIn } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('carlosaugusto913@hotmail.com')
  const [password, setPassword] = useState('Skip@Pass')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await signIn(email, password)
    setLoading(false)

    if (error) {
      toast({
        title: 'Falha na autenticação',
        description: getErrorMessage(error) || 'E-mail ou senha inválidos.',
        variant: 'destructive',
      })
    } else {
      toast({ title: 'Bem-vindo de volta!', description: 'Acesso realizado com sucesso.' })
      navigate('/')
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-orange-500/20 rounded-full blur-3xl" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />

      <Card className="w-full max-w-md bg-slate-800/90 border-slate-700 text-white shadow-2xl relative z-10 backdrop-blur-md">
        <CardHeader className="text-center space-y-3 pb-6">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-orange-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/30">
            <Truck className="w-8 h-8" />
          </div>
          <div>
            <CardTitle className="text-2xl font-black tracking-tight">
              Catálogo de Carregamento
            </CardTitle>
            <CardDescription className="text-slate-400 text-xs mt-1">
              Controle de Cargas, Romaneios e Conversão de Caixas
            </CardDescription>
          </div>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-slate-200">
                E-mail Profissional
              </Label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operador@empresa.com"
                  className="pl-9 bg-slate-900/60 border-slate-700 text-white placeholder:text-slate-500"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-slate-200">
                Senha de Acesso
              </Label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-9 bg-slate-900/60 border-slate-700 text-white placeholder:text-slate-500"
                  required
                />
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-4 pt-2">
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2.5 font-bold shadow-lg shadow-orange-500/30"
            >
              {loading ? (
                'Entrando...'
              ) : (
                <span className="flex items-center gap-2">
                  Entrar no Sistema <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </Button>

            <p className="text-xs text-center text-slate-400">
              Não possui conta?{' '}
              <Link to="/cadastro" className="text-orange-400 font-semibold hover:underline">
                Criar conta
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
