/**
 * Painel de cenários do servidor simulado (só existe com VITE_ENABLE_MOCKS=true).
 *
 * Importante: o painel age sobre o SERVIDOR simulado (mockControl), nunca sobre
 * o estado do app. Ao mudar um preço, por exemplo, o banco do mock é alterado e
 * o app recebe o evento `nft.updated` pelo socket.io-client, como em produção.
 */
import { FlaskConical } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { mockControl } from '../control'
import { db } from '../db'
import { isPresetName, PRESETS, type PresetName } from '../scenarios'

export default function MockPanel() {
  const [open, setOpen] = useState(false)
  const [preset, setPreset] = useState(mockControl.getScenario().preset)
  const [nftId, setNftId] = useState('nft-001')
  const [price, setPrice] = useState('2.5')
  const [message, setMessage] = useState('')

  const nft = open ? db().nfts.find((n) => n.id === nftId) : undefined

  function run(label: string, action: () => unknown) {
    try {
      action()
      setMessage(`✓ ${label}`)
    } catch (error) {
      setMessage(`✗ ${error instanceof Error ? error.message : 'Falhou'}`)
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="fixed top-[45%] left-0 z-50 flex items-center gap-2 rounded-r-full border border-l-0 border-primary/60 bg-card px-2 py-2 text-xs font-bold text-brand-accent shadow-lg lg:top-auto lg:bottom-4 lg:left-3 lg:rounded-full lg:border-l lg:px-3"
          data-testid="mock-panel-trigger"
        >
          <FlaskConical className="size-4" aria-hidden="true" />
          <span className="max-lg:sr-only">Cenários</span>
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[340px] overflow-y-auto bg-card">
        <SheetHeader>
          <SheetTitle>Servidor simulado</SheetTitle>
          <SheetDescription>
            Controla o MSW e o Socket.IO simulado. As mudanças chegam ao app pela API e pelos
            eventos em tempo real.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-6 px-4 pb-8 text-sm">
          <section className="flex flex-col gap-2">
            <Label htmlFor="mock-preset">Cenário</Label>
            <Select
              value={preset === 'custom' ? undefined : preset}
              onValueChange={(value) => {
                if (!isPresetName(value)) return
                mockControl.setScenario(value)
                setPreset(value)
                setMessage(`✓ Cenário "${value}" ativo`)
              }}
            >
              <SelectTrigger id="mock-preset" className="w-full">
                <SelectValue placeholder="Personalizado" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PRESETS) as PresetName[]).map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {preset !== 'custom' ? (
              <p className="text-muted-foreground">{PRESETS[preset as PresetName].description}</p>
            ) : null}
            <Button variant="outline" onClick={() => void mockControl.reset()}>
              Restaurar dados iniciais (reset)
            </Button>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="font-bold">Catálogo (evento nft.updated)</h3>
            <Label htmlFor="mock-nft">NFT</Label>
            <Input id="mock-nft" value={nftId} onChange={(e) => setNftId(e.target.value)} />
            {nft ? (
              <p className="text-muted-foreground">
                {nft.name} · {nft.price} ETH
              </p>
            ) : null}
            <Label htmlFor="mock-price">Novo preço (todas as edições)</Label>
            <Input id="mock-price" value={price} onChange={(e) => setPrice(e.target.value)} />
            <Button
              onClick={() => run('Preço alterado', () => mockControl.changePrice(nftId, price))}
            >
              Alterar preço
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                run('Edições esgotadas', () =>
                  nft?.editions.forEach((e) => mockControl.setAvailability(nftId, e.id, 0)),
                )
              }
            >
              Esgotar todas as edições
            </Button>
            <Button
              variant="outline"
              onClick={() => run('Evento reenviado', () => mockControl.replayLastEvent())}
            >
              Reenviar último evento (duplicado)
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                run('Evento antigo enviado', () => mockControl.sendStaleNftEvent(nftId))
              }
            >
              Enviar evento antigo (versão menor)
            </Button>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="font-bold">Sessão e conexão</h3>
            <Button
              variant="outline"
              onClick={() => run('Sessões expiradas', () => mockControl.expireSessions())}
            >
              Expirar sessão agora
            </Button>
            <Button
              variant="outline"
              onClick={() => run('Conexão derrubada por 5 s', () => mockControl.dropRealtime(5000))}
            >
              Derrubar Socket.IO (5 s)
            </Button>
            <Button
              variant="outline"
              onClick={() => run('Pedidos resolvidos', () => mockControl.resolvePendingOrders())}
            >
              Resolver pedidos pendentes agora
            </Button>
          </section>

          <p role="status" className="min-h-5 text-brand-accent">
            {message}
          </p>
        </div>
      </SheetContent>
    </Sheet>
  )
}
