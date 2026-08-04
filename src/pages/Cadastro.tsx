import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Truck, ArrowRight, Lock, Mail, User } from 'lucide-react'
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

export default function Cadastro() {
  const navigate = useNavigate()
  const { signUp } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== passwordConfirm) {
      toast({
        title: 'Senhas divergentes',
        description: 'A confirmação de senha não confere.',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    const { error } = await signUp(email, password)
    setLoading(false)

    if (error) {
      toast({
        title: 'Erro ao cadastrar',
        description: getErrorMessage(error),
        variant: 'destructive',
      })
    } else {
      toast({ title: 'Conta criada!', description: 'Sua conta foi aberta com sucesso.' })
      navigate('/')
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      <Card className="w-full max-w-md bg-slate-800/90 border-slate-700 text-white shadow-2xl relative z-10 backdrop-blur-md">
        <CardHeader className="text-center space-y-2 pb-4">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-orange-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/30">
            <Truck className="w-6 h-6" />
          </div>
          <CardTitle className="text-xl font-bold">Criar Nova Conta</CardTitle>
          <CardDescription className="text-slate-400 text-xs">
            Cadastre seu e-mail para operar o catálogo de carregamento
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="email" className="text-slate-200 text-xs">
                E-mail
              </Label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu.email@empresa.com"
                  className="pl-9 bg-slate-900/60 border-slate-700 text-white"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="password" className="text-slate-200 text-xs">
                Senha (mínimo 8 caracteres)
              </Label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-9 bg-slate-900/60 border-slate-700 text-white"
                  required
                  minLength={8}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="passwordConfirm" className="text-slate-200 text-xs">
                Confirmar Senha
              </Label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <Input
                  id="passwordConfirm"
                  type="password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  placeholder="••••••••"
                  className="pl-9 bg-slate-900/60 border-slate-700 text-white"
                  required
                />
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3 pt-2">
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2 font-bold"
            >
              {loading ? 'Cadastrando...' : 'Criar Conta e Acessar'}
            </Button>

            <p className="text-xs text-center text-slate-400">
              Já tem uma conta?{' '}
              <Link to="/login" className="text-orange-400 font-semibold hover:underline">
                Entrar
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
