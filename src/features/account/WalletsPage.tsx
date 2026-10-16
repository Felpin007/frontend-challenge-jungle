import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import {
  NETWORKS,
  WALLET_PROVIDERS,
  WalletInput,
  type Wallet,
  type WalletSlot,
} from '@/api/contracts'
import { ApiError } from '@/api/http'
import { ErrorState } from '@/components/feedback/States'
import { applyServerErrors, Field, FormError } from '@/components/forms/Field'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { NETWORK_LABEL, PROVIDER_LABEL } from '@/features/checkout/labels'
import { useRemoveSecondaryWallet, useSaveWallet, useWallets } from './queries'

const EMPTY: WalletInput = {
  displayName: '',
  nickname: '',
  network: 'ethereum',
  profileName: '',
  address: '',
  secondaryAddress: null,
  provider: 'metamask',
  referralCode: '',
  email: '',
  ensName: '',
}

function toInput(wallet: Wallet | null): WalletInput {
  if (!wallet) return EMPTY
  const { id: _i, slot: _s, createdAt: _c, updatedAt: _u, ...input } = wallet
  return input
}

export function WalletsPage() {
  const wallets = useWallets()
  const removeSecondary = useRemoveSecondaryWallet()
  const [editing, setEditing] = useState<{ primary: boolean; secondary: boolean }>({
    primary: false,
    secondary: false,
  })
  const [copyPrimary, setCopyPrimary] = useState(false)

  if (wallets.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <p className="sr-only" role="status">
          Carregando carteiras…
        </p>
        {[0, 1, 2].map((i) => (
          <div key={i} className="shimmer h-16 rounded-sm" aria-hidden="true" />
        ))}
      </div>
    )
  }
  if (wallets.isError)
    return <ErrorState error={wallets.error} onRetry={() => void wallets.refetch()} />
  const { primary, secondary } = wallets.data
  const showPrimaryForm = Boolean(primary) || editing.primary
  const showSecondaryForm = Boolean(secondary) || editing.secondary

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="primary-title" className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 id="primary-title" className="text-lg font-bold">
              Carteira principal
            </h1>
            <p className="text-[15px] text-muted-foreground">
              Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados.
            </p>
          </div>
          {!showPrimaryForm ? (
            <button
              type="button"
              className="text-lg font-bold text-brand-accent"
              onClick={() => setEditing((e) => ({ ...e, primary: true }))}
            >
              Adicionar
            </button>
          ) : null}
        </div>
        {showPrimaryForm ? (
          <WalletForm
            key={primary?.updatedAt ?? 'new-primary'}
            slot="primary"
            initial={toInput(primary)}
          />
        ) : (
          <p className="text-[15px] text-muted-foreground">
            Você ainda não cadastrou uma carteira principal.
          </p>
        )}
      </section>

      <section aria-labelledby="secondary-title" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 id="secondary-title" className="text-lg font-bold">
              Carteira secundária
            </h2>
            {!showSecondaryForm ? (
              <p className="text-[15px] text-muted-foreground">
                Você ainda não adicionou uma carteira secundária.
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            {primary ? (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="same-as-primary"
                  className="rounded-full"
                  checked={copyPrimary}
                  onCheckedChange={(checked) => {
                    setCopyPrimary(checked === true)
                    if (checked === true) setEditing((e) => ({ ...e, secondary: true }))
                  }}
                />
                <Label htmlFor="same-as-primary" className="font-normal">
                  Igual à carteira principal
                </Label>
              </div>
            ) : null}
            {!showSecondaryForm ? (
              <button
                type="button"
                className="text-lg font-bold text-brand-accent disabled:opacity-50"
                onClick={() => setEditing((e) => ({ ...e, secondary: true }))}
                disabled={!primary}
                title={!primary ? 'Cadastre a carteira principal primeiro' : undefined}
              >
                Adicionar
              </button>
            ) : secondary ? (
              <button
                type="button"
                className="text-[15px] text-destructive hover:underline"
                onClick={() =>
                  removeSecondary.mutate(undefined, {
                    onSuccess: () => {
                      setEditing((e) => ({ ...e, secondary: false }))
                      toast.success('Carteira secundária removida.')
                    },
                  })
                }
              >
                Remover
              </button>
            ) : null}
          </div>
        </div>
        {showSecondaryForm ? (
          <WalletForm
            key={`${secondary?.updatedAt ?? 'new-secondary'}-${copyPrimary}`}
            slot="secondary"
            initial={
              copyPrimary && primary
                ? { ...toInput(primary), nickname: `${primary.nickname} 2` }
                : toInput(secondary)
            }
          />
        ) : null}
      </section>
    </div>
  )
}

function WalletForm({ slot, initial }: { slot: WalletSlot; initial: WalletInput }) {
  const save = useSaveWallet()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<WalletInput>({ resolver: zodResolver(WalletInput), defaultValues: initial })
  const { errors } = form.formState
  const prefix = slot === 'primary' ? 'principal' : 'secundária'

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null)
    save.mutate(
      { slot, body: { ...values, secondaryAddress: values.secondaryAddress?.trim() || null } },
      {
        onSuccess: () => toast.success(`Carteira ${prefix} salva.`),
        onError: (error) => {
          if (
            error instanceof ApiError &&
            applyServerErrors(
              error.fieldErrors,
              form.setError,
              Object.keys(EMPTY) as Array<keyof WalletInput & string>,
            )
          )
            return
          setFormError(
            error instanceof ApiError ? error.message : 'Não foi possível salvar a carteira.',
          )
        },
      },
    )
  })

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      aria-label={`Carteira ${prefix}`}
      className="flex flex-col gap-6"
      data-testid={`wallet-form-${slot}`}
    >
      <FormError message={formError} />
      <div className="grid gap-x-7 gap-y-5 md:grid-cols-2">
        <Field label="Nome de exibição" required error={errors.displayName?.message}>
          {(p) => <Input {...p} {...form.register('displayName')} />}
        </Field>
        <Field label="Apelido da carteira" required error={errors.nickname?.message}>
          {(p) => <Input {...p} {...form.register('nickname')} />}
        </Field>
        <Field label="Rede" required error={errors.network?.message}>
          {(p) => (
            <Controller
              control={form.control}
              name="network"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger {...p} className="h-10 w-full">
                    <SelectValue placeholder="Selecione uma rede" />
                  </SelectTrigger>
                  <SelectContent>
                    {NETWORKS.map((n) => (
                      <SelectItem key={n} value={n}>
                        {NETWORK_LABEL[n]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          )}
        </Field>
        <Field label="Nome do perfil" required error={errors.profileName?.message}>
          {(p) => <Input {...p} {...form.register('profileName')} />}
        </Field>
        <Field label="Endereço da carteira" required error={errors.address?.message}>
          {(p) => (
            <Input
              {...p}
              placeholder="Endereço 0x da carteira"
              spellCheck={false}
              {...form.register('address')}
            />
          )}
        </Field>
        <Field
          label="ENS ou carteira secundária (opcional)"
          error={errors.secondaryAddress?.message}
        >
          {(p) => (
            <Input
              {...p}
              placeholder="ENS ou carteira secundária (opcional)"
              {...form.register('secondaryAddress')}
            />
          )}
        </Field>
        <Field label="Tipo de carteira" required error={errors.provider?.message}>
          {(p) => (
            <Controller
              control={form.control}
              name="provider"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger {...p} className="h-10 w-full">
                    <SelectValue placeholder="Selecione uma carteira" />
                  </SelectTrigger>
                  <SelectContent>
                    {WALLET_PROVIDERS.map((w) => (
                      <SelectItem key={w} value={w}>
                        {PROVIDER_LABEL[w]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          )}
        </Field>
        <Field label="Código de indicação" required error={errors.referralCode?.message}>
          {(p) => <Input {...p} {...form.register('referralCode')} />}
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
      </div>
      <div>
        <Button type="submit" className="h-10 font-bold" disabled={save.isPending}>
          {save.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          Salvar carteira
        </Button>
      </div>
    </form>
  )
}
