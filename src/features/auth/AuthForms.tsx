import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { LoginRequest, PASSWORD_RULES, RegisterRequest } from '@/api/contracts'
import { ApiError } from '@/api/http'
import { ComingSoon } from '@/components/common/ComingSoon'
import { applyServerErrors, Field, FormError, PasswordInput } from '@/components/forms/Field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useLogin, useRegister } from './queries'
import type { AuthSearch } from './search'

function useAfterAuth(search: AuthSearch) {
  const navigate = useNavigate()
  // Retoma o fluxo de origem (ex.: checkout) ou volta para o início.
  return () => navigate({ href: search.redirect ?? '/', replace: true })
}

export function LoginForm({ search }: { search: AuthSearch }) {
  const login = useLogin()
  const afterAuth = useAfterAuth(search)
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<LoginRequest>({
    resolver: zodResolver(LoginRequest),
    defaultValues: { email: '', password: '' },
  })
  const { errors } = form.formState

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null)
    login.mutate(values, {
      onSuccess: () => void afterAuth(),
      onError: (error) => {
        if (
          error instanceof ApiError &&
          applyServerErrors(error.fieldErrors, form.setError, ['email', 'password'])
        )
          return
        setFormError(
          error instanceof ApiError ? error.message : 'Não foi possível entrar. Tente novamente.',
        )
      },
    })
  })

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-3 lg:gap-4"
      aria-label="Entrar"
    >
      {search.reason === 'expired' ? (
        <p
          role="status"
          className="rounded-md border border-amber/50 bg-amber/10 px-3 py-2 text-sm text-amber"
        >
          Sua sessão expirou. Entre novamente para continuar de onde parou.
        </p>
      ) : null}
      <FormError message={formError} />
      <Field label="E-mail" srOnlyLabel error={errors.email?.message}>
        {(props) => (
          <Input
            {...props}
            className="max-lg:h-[50px] max-lg:rounded-[10px]"
            type="email"
            autoComplete="email"
            placeholder="contato@email.com"
            {...form.register('email')}
          />
        )}
      </Field>
      <Field label="Senha" srOnlyLabel error={errors.password?.message}>
        {(props) => (
          <PasswordInput
            {...props}
            className="max-lg:h-[50px] max-lg:rounded-[10px]"
            autoComplete="current-password"
            placeholder="Senha"
            {...form.register('password')}
          />
        )}
      </Field>
      <div className="flex justify-end">
        <ComingSoon
          className="text-sm text-brand-accent"
          label="Recuperação de senha indisponível na demonstração"
        >
          Esqueceu a senha?
        </ComingSoon>
      </div>
      {/* Mobile (Figma): 40 px entre o formulário e o botão */}
      <Button
        type="submit"
        className="mt-2 h-11 text-base font-bold max-lg:mt-7 max-lg:h-[60px] max-lg:rounded-[10px]"
        disabled={login.isPending}
      >
        {login.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
        Entrar
      </Button>
    </form>
  )
}

const RegisterFormSchema = RegisterRequest.extend({ confirmPassword: z.string() }).refine(
  (v) => v.password === v.confirmPassword,
  { path: ['confirmPassword'], message: 'As senhas não conferem' },
)
type RegisterFormValues = z.infer<typeof RegisterFormSchema>

export function RegisterForm({ search, submitLabel }: { search: AuthSearch; submitLabel: string }) {
  const register = useRegister()
  const afterAuth = useAfterAuth(search)
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(RegisterFormSchema),
    defaultValues: { username: '', email: '', password: '', confirmPassword: '' },
  })
  const { errors } = form.formState

  const onSubmit = form.handleSubmit(({ confirmPassword: _c, ...values }) => {
    setFormError(null)
    register.mutate(values, {
      onSuccess: () => void afterAuth(),
      onError: (error) => {
        if (
          error instanceof ApiError &&
          applyServerErrors(error.fieldErrors, form.setError, ['username', 'email', 'password'])
        )
          return
        setFormError(
          error instanceof ApiError
            ? error.message
            : 'Não foi possível criar a conta. Tente novamente.',
        )
      },
    })
  })

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3" aria-label="Criar conta">
      <FormError message={formError} />
      <Field label="Nome de usuário" srOnlyLabel error={errors.username?.message}>
        {(props) => (
          <Input
            {...props}
            className="max-lg:h-[50px] max-lg:rounded-[10px]"
            autoComplete="username"
            placeholder="Nome de usuário"
            {...form.register('username')}
          />
        )}
      </Field>
      <Field label="E-mail" srOnlyLabel error={errors.email?.message}>
        {(props) => (
          <Input
            {...props}
            className="max-lg:h-[50px] max-lg:rounded-[10px]"
            type="email"
            autoComplete="email"
            placeholder="Digite seu e-mail"
            {...form.register('email')}
          />
        )}
      </Field>
      {/* A regra da senha aparece com o campo em foco (o Figma não reserva espaço para ela) */}
      <Field
        label="Senha"
        srOnlyLabel
        error={errors.password?.message}
        hint={`Senha: ${PASSWORD_RULES.toLowerCase()}.`}
        hintClassName="hidden group-focus-within/password:block"
        className="group/password"
      >
        {(props) => (
          <PasswordInput
            {...props}
            className="max-lg:h-[50px] max-lg:rounded-[10px]"
            autoComplete="new-password"
            placeholder="Senha"
            {...form.register('password')}
          />
        )}
      </Field>
      <Field label="Confirmar senha" srOnlyLabel error={errors.confirmPassword?.message}>
        {(props) => (
          <PasswordInput
            {...props}
            className="max-lg:h-[50px] max-lg:rounded-[10px]"
            autoComplete="new-password"
            placeholder="Confirmar senha"
            {...form.register('confirmPassword')}
          />
        )}
      </Field>
      <Button
        type="submit"
        className="mt-2 h-11 text-base font-bold max-lg:mt-7 max-lg:h-[60px] max-lg:rounded-[10px]"
        disabled={register.isPending}
      >
        {register.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
        {submitLabel}
      </Button>
    </form>
  )
}
