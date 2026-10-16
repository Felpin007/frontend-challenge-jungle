import { Link } from '@tanstack/react-router'
import { CircleCheck, EllipsisVertical, Loader2, Unplug, Wallet as WalletIcon } from 'lucide-react'
import type { Network, Wallet, WalletProvider, WalletsResponse } from '@/api/contracts'
import { errorMessage } from '@/components/feedback/States'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { cn } from '@/lib/utils'
import { NETWORK_LABEL, PROVIDER_LABEL, shortAddress } from './labels'

/** Mobile (Figma "Mobile / Pagamento"): carteiras cadastradas, com menu de opções. */
export function SavedWalletsPicker({
  wallets,
  selected,
  onSelect,
}: {
  wallets: WalletsResponse
  selected: 'primary' | 'secondary'
  onSelect: (slot: 'primary' | 'secondary') => void
}) {
  const list = [wallets.secondary, wallets.primary].filter((w): w is Wallet => w !== null)
  return (
    <section aria-labelledby="saved-wallets" className="flex flex-col gap-4 lg:hidden">
      <div className="flex items-center justify-between">
        <h2 id="saved-wallets" className="leading-4 font-bold">
          Carteira conectada
        </h2>
        <Link to="/perfil/carteiras" className="text-sm leading-4 font-bold text-brand-accent">
          Trocar carteira
        </Link>
      </div>
      <RadioGroup
        value={selected}
        onValueChange={(slot) => onSelect(slot === 'secondary' ? 'secondary' : 'primary')}
        aria-labelledby="saved-wallets"
        className="gap-5"
      >
        {list.map((wallet) => (
          <div
            key={wallet.id}
            className="relative flex min-h-[93px] items-center rounded-[14px] bg-card shadow-[0_6px_20px_rgb(10_6_4/0.45)]"
          >
            <Label
              htmlFor={`wallet-${wallet.slot}`}
              className="flex flex-1 cursor-pointer items-center gap-[19px] py-[15px] pr-12 pl-[19px] font-normal"
            >
              <RadioGroupItem
                id={`wallet-${wallet.slot}`}
                value={wallet.slot}
                className="size-4 border-[#55321f] data-[state=checked]:border-primary"
              />
              <span className="flex flex-col gap-1.5">
                <span className="leading-4 font-bold">{wallet.nickname}</span>
                <span className="text-sm leading-[22px] text-muted-foreground">
                  {wallet.secondaryAddress ?? shortAddress(wallet.address)}
                  <br />
                  Rede {wallet.slot === 'primary' ? 'principal ' : ''}
                  {NETWORK_LABEL[wallet.network]}
                </span>
              </span>
            </Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="absolute top-1/2 right-2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:text-foreground"
                  aria-label={`Opções da carteira ${wallet.nickname}`}
                >
                  <EllipsisVertical className="size-5" aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link to="/perfil/carteiras">Editar carteira</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </RadioGroup>
    </section>
  )
}

const PROVIDERS = ['walletconnect', 'metamask', 'coinbase'] as const

/**
 * "Carteira e rede". Desktop (Figma): linhas de 45 px com borda, a selecionada em
 * laranja; a primeira mostra o selo das carteiras compatíveis. Mobile: cartões de
 * 65 px com ícone e o rádio à direita.
 */
export function ProviderOptions({
  value,
  onChange,
}: {
  value: WalletProvider
  onChange: (provider: WalletProvider) => void
}) {
  return (
    <RadioGroup
      value={value}
      onValueChange={(provider) => onChange(provider as WalletProvider)}
      aria-labelledby="wallet-network"
      className="gap-4"
    >
      {PROVIDERS.map((provider) => {
        const selected = value === provider
        return (
          <Label
            key={provider}
            htmlFor={`provider-${provider}`}
            className={cn(
              'flex cursor-pointer items-center font-normal',
              // mobile
              'h-[65px] gap-[11px] rounded-[15px] bg-card px-3.5 text-sm shadow-[0_6px_20px_rgb(10_6_4/0.45)]',
              // desktop
              'lg:h-[45px] lg:gap-2.5 lg:rounded-[3px] lg:border lg:bg-transparent lg:px-3 lg:text-[15px] lg:shadow-none',
              selected ? 'lg:border-primary' : 'lg:border-border',
            )}
          >
            <RadioGroupItem
              id={`provider-${provider}`}
              value={provider}
              className="size-4 border-[#55321f] data-[state=checked]:border-primary max-lg:order-last max-lg:ml-auto lg:border-primary"
            />
            <span
              className="grid size-10 shrink-0 place-items-center rounded-full border border-border bg-secondary text-sm font-bold text-brand-accent lg:hidden"
              aria-hidden="true"
            >
              {provider === 'coinbase' ? (
                <WalletIcon className="size-5" />
              ) : (
                PROVIDER_LABEL[provider][0]
              )}
            </span>
            {provider === 'walletconnect' ? (
              <>
                <span className="lg:hidden">{PROVIDER_LABEL[provider]}</span>
                <span className="hidden items-center gap-2 rounded-md border border-[#55321f] bg-surface-band px-2 py-[7px] text-[9px] leading-3 font-bold tracking-[0.01em] text-brand-accent lg:inline-flex">
                  <span className="sr-only">WalletConnect (compatível com </span>
                  METAMASK <span aria-hidden="true">•</span> WALLETCONNECT{' '}
                  <span aria-hidden="true">•</span> COINBASE
                  <span className="sr-only">)</span>
                </span>
              </>
            ) : (
              PROVIDER_LABEL[provider]
            )}
          </Label>
        )
      })}
    </RadioGroup>
  )
}

/** Simulação da extensão da carteira: conectar, recusa e desconectar. */
export function ConnectionPanel({
  provider,
  network,
  wallet,
  connected,
  connecting,
  error,
  onConnect,
  onDisconnect,
  disconnecting,
}: {
  provider: WalletProvider
  network: Network
  wallet: Wallet
  connected: boolean
  connecting: boolean
  error: unknown
  onConnect: () => void
  onDisconnect: () => void
  disconnecting: boolean
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-[15px] bg-card px-3.5 py-3 shadow-[0_6px_20px_rgb(10_6_4/0.45)] lg:rounded-[3px] lg:border lg:bg-transparent lg:px-3 lg:shadow-none',
        connected ? 'lg:border-success' : 'lg:border-border',
      )}
      data-testid="wallet-connection"
    >
      <div className="flex items-center justify-between gap-3">
        <p aria-live="polite" className="text-sm">
          {connecting ? (
            <span className="flex items-center gap-2 text-brand-accent">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Aguardando aprovação…
            </span>
          ) : connected ? (
            <span className="flex items-center gap-2 text-success">
              <CircleCheck className="size-4" aria-hidden="true" /> Carteira conectada
            </span>
          ) : error ? (
            <span className="text-destructive">
              {errorMessage(error, 'Não foi possível conectar.')}
            </span>
          ) : (
            <span className="text-muted-foreground">Carteira desconectada</span>
          )}
        </p>
        {connected ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onDisconnect}
            disabled={disconnecting}
          >
            <Unplug className="size-4" aria-hidden="true" /> Desconectar
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="shrink-0"
            onClick={onConnect}
            disabled={connecting}
            data-testid="connect-wallet"
          >
            {error ? 'Tentar de novo' : 'Conectar carteira'}
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {PROVIDER_LABEL[provider]} · Rede {NETWORK_LABEL[network]} · {shortAddress(wallet.address)}
      </p>
    </div>
  )
}
