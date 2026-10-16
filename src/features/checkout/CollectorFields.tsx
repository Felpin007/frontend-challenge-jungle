import { Link } from '@tanstack/react-router'
import { Controller, type UseFormReturn } from 'react-hook-form'
import { z } from 'zod'
import {
  CollectorInfo,
  Network,
  NETWORKS,
  WALLET_PROVIDERS,
  WalletProvider,
  type Wallet,
  type WalletsResponse,
} from '@/api/contracts'
import { Field, FormError } from '@/components/forms/Field'
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
import { Textarea } from '@/components/ui/textarea'
import { NETWORK_LABEL, PROVIDER_LABEL } from './labels'

export const CheckoutFormSchema = CollectorInfo.extend({
  network: Network,
  provider: WalletProvider,
  useSecondary: z.boolean(),
})
export type CheckoutFormValues = z.infer<typeof CheckoutFormSchema>

/** Campos do Figma "Desktop / Pagamento": caixas de 370 × 40 px, cantos de 3 px. */
const control = 'h-10 rounded-[3px] lg:h-10'

/**
 * "Perfil do colecionador": dados do pedido. Endereço, ENS/secundária e tipo de
 * carteira vêm da carteira cadastrada (somente leitura) e, no mobile, ficam nos
 * cartões de carteira e nas opções de "Carteira e rede".
 */
export function CollectorFields({
  form,
  wallets,
  selectedWallet,
  formError,
}: {
  form: UseFormReturn<CheckoutFormValues>
  wallets: WalletsResponse
  selectedWallet: Wallet
  formError: string | null
}) {
  const { errors } = form.formState
  const field = (name: keyof CheckoutFormValues) => errors[name]?.message as string | undefined

  return (
    <section
      aria-labelledby="collector-title"
      className="flex flex-1 flex-col gap-3 max-lg:order-3"
    >
      <h2 id="collector-title" className="text-[17px] leading-4 font-bold">
        Perfil do colecionador
      </h2>
      <FormError message={formError} />
      <div className="flex flex-col gap-4 lg:gap-6">
        <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:gap-y-[19px]">
          <Field label="Nome de exibição" required error={field('displayName')}>
            {(p) => (
              <Input
                {...p}
                className={control}
                autoComplete="name"
                {...form.register('displayName')}
              />
            )}
          </Field>
          <Field label="Nome de usuário" required error={field('username')}>
            {(p) => (
              <Input
                {...p}
                className={control}
                autoComplete="username"
                {...form.register('username')}
              />
            )}
          </Field>
          <Field label="Rede" required error={field('network')}>
            {(p) => (
              <Controller
                control={form.control}
                name="network"
                render={({ field: f }) => (
                  <Select value={f.value} onValueChange={f.onChange}>
                    <SelectTrigger
                      {...p}
                      className="h-10 w-full rounded-[3px]"
                      data-testid="network-select"
                    >
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
          <Field label="Nome do perfil" required error={field('profileName')}>
            {(p) => <Input {...p} className={control} {...form.register('profileName')} />}
          </Field>
          <Field label="Endereço da carteira" className="max-lg:hidden" required>
            {(p) => (
              <Input
                {...p}
                value={selectedWallet.address}
                readOnly
                title={selectedWallet.address}
                className={`${control} text-ellipsis text-muted-foreground`}
              />
            )}
          </Field>
          <Field label="ENS ou carteira secundária (opcional)" className="max-lg:hidden">
            {(p) => (
              <Input
                {...p}
                value={selectedWallet.secondaryAddress ?? ''}
                readOnly
                placeholder="Não informado"
                className={`${control} text-ellipsis text-muted-foreground`}
              />
            )}
          </Field>
          <Field
            label="Tipo de carteira"
            className="max-lg:hidden"
            required
            error={field('provider')}
          >
            {(p) => (
              <Controller
                control={form.control}
                name="provider"
                render={({ field: f }) => (
                  <Select value={f.value} onValueChange={f.onChange}>
                    <SelectTrigger
                      {...p}
                      className="h-10 w-full rounded-[3px]"
                      data-testid="provider-select"
                    >
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
          <Field label="Código de indicação" required error={field('referralCode')}>
            {(p) => <Input {...p} className={control} {...form.register('referralCode')} />}
          </Field>
          <Field label="E-mail" required error={field('email')}>
            {(p) => (
              <Input
                {...p}
                className={control}
                type="email"
                autoComplete="email"
                {...form.register('email')}
              />
            )}
          </Field>
          <Field label="Nome ENS" required error={field('ensName')}>
            {(p) => (
              <div className="flex gap-2">
                <span
                  className="grid h-10 w-[78px] shrink-0 place-items-center rounded-[3px] border border-input text-[15px]"
                  aria-hidden="true"
                >
                  .eth
                </span>
                <Input {...p} className={control} {...form.register('ensName')} />
              </div>
            )}
          </Field>
        </div>
        <div className="flex items-center gap-2 max-lg:hidden">
          <Controller
            control={form.control}
            name="useSecondary"
            render={({ field: f }) => (
              <Checkbox
                id="use-secondary"
                checked={f.value}
                onCheckedChange={(checked) => f.onChange(checked === true)}
                disabled={!wallets.secondary}
                className="size-[15px] rounded-full border-2 border-primary"
              />
            )}
          />
          <Label htmlFor="use-secondary" className="text-[15px] font-normal">
            Usar outra carteira?
          </Label>
          {!wallets.secondary ? (
            <Link to="/perfil/carteiras" className="text-sm text-brand-accent hover:underline">
              Cadastrar carteira secundária
            </Link>
          ) : (
            <span className="text-sm text-muted-foreground">({wallets.secondary.nickname})</span>
          )}
        </div>
        <Field
          label="Observação do colecionador (opcional)"
          error={field('note')}
          className="lg:max-w-[350px]"
        >
          {/* field-sizing-fixed: o textarea do shadcn cresce com o conteúdo e ignoraria a altura do Figma */}
          {(p) => (
            <Textarea
              {...p}
              rows={6}
              className="field-sizing-fixed h-28 resize-y rounded-[3px] lg:h-[152px]"
              {...form.register('note')}
            />
          )}
        </Field>
      </div>
    </section>
  )
}
