import { zodResolver } from '@hookform/resolvers/zod'
import { ImageIcon, Loader2 } from 'lucide-react'
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import {
  AVATAR_MAX_BYTES,
  AVATAR_TYPES,
  ChangePasswordRequest,
  ProfileUpdateRequest,
  type User,
} from '@/api/contracts'
import { ApiError } from '@/api/http'
import { ErrorState } from '@/components/feedback/States'
import { applyServerErrors, Field, FormError, PasswordInput } from '@/components/forms/Field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  useChangePassword,
  useProfile,
  useRemoveAvatar,
  useUpdateProfile,
  useUploadAvatar,
} from './queries'

export function ProfilePage() {
  const profile = useProfile()
  if (profile.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <p className="sr-only" role="status">
          Carregando perfil…
        </p>
        {[0, 1, 2].map((i) => (
          <div key={i} className="shimmer h-16 rounded-sm" aria-hidden="true" />
        ))}
      </div>
    )
  }
  if (profile.isError)
    return <ErrorState error={profile.error} onRetry={() => void profile.refetch()} />
  return (
    <div className="flex flex-col gap-10">
      <ProfileForm user={profile.data} />
      <PasswordForm />
    </div>
  )
}

function ProfileForm({ user }: { user: User }) {
  const update = useUpdateProfile()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<ProfileUpdateRequest>({
    resolver: zodResolver(ProfileUpdateRequest),
    defaultValues: {
      displayName: user.displayName,
      username: user.username,
      email: user.email,
      ensName: user.ensName ?? '',
      walletNickname: user.walletNickname ?? '',
    },
  })
  const { errors, isDirty } = form.formState

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null)
    update.mutate(values, {
      onSuccess: (saved) => {
        form.reset({
          ...values,
          ensName: saved.ensName ?? '',
          walletNickname: saved.walletNickname ?? '',
        })
        toast.success('Perfil atualizado.')
      },
      onError: (error) => {
        if (
          error instanceof ApiError &&
          applyServerErrors(error.fieldErrors, form.setError, [
            'displayName',
            'username',
            'email',
            'ensName',
            'walletNickname',
          ])
        )
          return
        setFormError(
          error instanceof ApiError ? error.message : 'Não foi possível salvar o perfil.',
        )
      },
    })
  })

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      aria-labelledby="profile-title"
      className="flex flex-col gap-6"
    >
      <h1 id="profile-title" className="text-lg font-bold">
        Perfil do colecionador
      </h1>
      <FormError message={formError} />
      {/* Figma "Perfil do Colecionador": linhas de 103 px (campo de 79 px + 24 px) */}
      <div className="grid gap-x-7 gap-y-6 md:grid-cols-2 lg:gap-y-[34px]">
        <Field label="Nome de exibição" required error={errors.displayName?.message}>
          {(p) => <Input {...p} autoComplete="name" {...form.register('displayName')} />}
        </Field>
        <Field label="Nome de usuário" required error={errors.username?.message}>
          {(p) => <Input {...p} autoComplete="username" {...form.register('username')} />}
        </Field>
        <Field label="E-mail" required error={errors.email?.message}>
          {(p) => <Input {...p} type="email" autoComplete="email" {...form.register('email')} />}
        </Field>
        <Field label="Nome ENS" required error={errors.ensName?.message}>
          {(p) => (
            <div className="flex gap-2">
              <span
                className="grid h-10 place-items-center rounded-[3px] border border-input px-3 text-[15px]"
                aria-hidden="true"
              >
                .eth
              </span>
              <Input {...p} {...form.register('ensName')} />
            </div>
          )}
        </Field>
        <Field label="Apelido da carteira" required error={errors.walletNickname?.message}>
          {(p) => <Input {...p} {...form.register('walletNickname')} />}
        </Field>
        <AvatarField user={user} />
      </div>
      <div>
        <Button
          type="submit"
          className="h-10 w-[131px] font-bold"
          disabled={update.isPending || !isDirty}
        >
          {update.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          Salvar
        </Button>
      </div>
    </form>
  )
}

function AvatarField({ user }: { user: User }) {
  const upload = useUploadAvatar()
  const remove = useRemoveAvatar()
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!(AVATAR_TYPES as readonly string[]).includes(file.type)) {
      setError('Use uma imagem PNG, JPEG ou WEBP.')
      return
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setError('A imagem deve ter no máximo 1 MB.')
      return
    }
    setError(null)
    const reader = new FileReader()
    reader.onload = () =>
      upload.mutate(String(reader.result), {
        onSuccess: () => toast.success('Avatar atualizado.'),
        onError: (e) =>
          setError(e instanceof ApiError ? e.message : 'Não foi possível enviar o avatar.'),
      })
    reader.readAsDataURL(file)
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-base" id="avatar-label">
        Avatar
      </p>
      <div className="flex items-center gap-6">
        <div className="grid size-[50px] place-items-center overflow-hidden rounded-full border border-border bg-accent">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={`Avatar de ${user.displayName}`}
              className="size-full object-cover"
              data-testid="avatar-image"
            />
          ) : (
            <ImageIcon className="size-6 text-brand-accent" aria-hidden="true" />
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={AVATAR_TYPES.join(',')}
          className="sr-only"
          onChange={onFile}
          aria-labelledby="avatar-label"
          aria-describedby={error ? 'avatar-error' : 'avatar-hint'}
          data-testid="avatar-input"
          tabIndex={-1}
        />
        <Button
          type="button"
          className="h-10 w-[98px] font-bold"
          onClick={() => inputRef.current?.click()}
          disabled={upload.isPending}
        >
          {upload.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          Alterar
        </Button>
        <button
          type="button"
          onClick={() =>
            remove.mutate(undefined, { onSuccess: () => toast.success('Avatar removido.') })
          }
          disabled={!user.avatarUrl || remove.isPending}
          className="text-[15px] disabled:opacity-50"
        >
          Remover
        </button>
      </div>
      <p id="avatar-hint" className="text-xs text-muted-foreground">
        PNG, JPEG ou WEBP de até 1 MB.
      </p>
      {error ? (
        <p id="avatar-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}

const PasswordFormSchema = ChangePasswordRequest.extend({ confirmPassword: z.string() }).refine(
  (v) => v.newPassword === v.confirmPassword,
  { path: ['confirmPassword'], message: 'As senhas não conferem' },
)
type PasswordFormValues = z.infer<typeof PasswordFormSchema>

function PasswordForm() {
  const change = useChangePassword()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(PasswordFormSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })
  const { errors } = form.formState

  useEffect(() => () => form.reset(), [form])

  const onSubmit = form.handleSubmit(({ confirmPassword: _c, ...values }) => {
    setFormError(null)
    change.mutate(values, {
      onSuccess: () => {
        form.reset()
        toast.success('Senha alterada.')
      },
      onError: (error) => {
        if (
          error instanceof ApiError &&
          applyServerErrors(error.fieldErrors, form.setError, ['currentPassword', 'newPassword'])
        )
          return
        setFormError(
          error instanceof ApiError ? error.message : 'Não foi possível alterar a senha.',
        )
      },
    })
  })

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      aria-labelledby="password-title"
      className="flex max-w-[417px] flex-col gap-5"
    >
      <h2 id="password-title" className="text-lg font-bold">
        Alterar senha
      </h2>
      <FormError message={formError} />
      <Field label="Senha atual" error={errors.currentPassword?.message}>
        {(p) => (
          <PasswordInput
            {...p}
            autoComplete="current-password"
            {...form.register('currentPassword')}
          />
        )}
      </Field>
      <Field
        label="Nova senha"
        error={errors.newPassword?.message}
        hint="Mínimo de 8 caracteres, com letra e número."
      >
        {(p) => (
          <PasswordInput {...p} autoComplete="new-password" {...form.register('newPassword')} />
        )}
      </Field>
      <Field label="Confirmar nova senha" error={errors.confirmPassword?.message}>
        {(p) => (
          <PasswordInput {...p} autoComplete="new-password" {...form.register('confirmPassword')} />
        )}
      </Field>
      <div>
        <Button type="submit" className="h-10 font-bold" disabled={change.isPending}>
          {change.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          Salvar nova senha
        </Button>
      </div>
    </form>
  )
}
