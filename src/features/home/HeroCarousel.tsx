import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { NftImage } from '@/components/nft/NftImage'
import { Button } from '@/components/ui/button'
import { featuredQueryOptions } from '@/features/catalog/queries'
import { useIsDesktop } from '@/hooks/use-media-query'
import { cn } from '@/lib/utils'

/**
 * Destaques da página inicial. Sem rotação automática (melhor para leitura,
 * acessibilidade e movimento reduzido): o usuário troca o slide pelos pontos.
 */
export function HeroCarousel() {
  const { data } = useQuery(featuredQueryOptions())
  const [index, setIndex] = useState(0)
  const slides = data?.hero ?? []
  const current = slides[index]
  // Renderiza só o layout atual: uma imagem escondida por CSS com prioridade alta
  // seria baixada mesmo assim e atrasaria o LCP.
  const isDesktop = useIsDesktop()

  return (
    <section aria-roledescription="carrossel" aria-label="Destaques" className="relative">
      {isDesktop ? (
        <div className="flex min-h-[450px] items-center gap-[110px] pl-10">
          <div className="flex max-w-[600px] flex-1 flex-col gap-11">
            <div className="flex flex-col gap-8">
              <div className="flex flex-col gap-1">
                <p className="text-[15px] tracking-[0.1em]">Bem-vindo à Kurio</p>
                <h1 className="text-[43px] leading-[70px] font-bold tracking-wide">
                  SEJA DONO DO FUTURO
                  <br />
                  DA ARTE DIGITAL
                </h1>
                <p className="max-w-[557px] text-sm leading-6 text-muted-foreground">
                  Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte
                  digital rara, apoie artistas e tenha uma parte da cultura da internet.
                </p>
              </div>
              <Button asChild className="h-10 w-[140px] text-base font-bold">
                <Link to="/" hash="catalogo">
                  EXPLORAR
                </Link>
              </Button>
            </div>
            <Dots
              count={slides.length || 3}
              index={index}
              onSelect={setIndex}
              className="self-end"
            />
          </div>
          <div className="size-[450px] shrink-0 overflow-hidden rounded-3xl">
            {current ? (
              <Link
                to="/nft/$nftId"
                params={{ nftId: current.id }}
                aria-label={`Ver ${current.name}`}
              >
                <NftImage image={current.image} sizes="450px" priority />
              </Link>
            ) : (
              <div className="shimmer size-full" aria-hidden="true" />
            )}
          </div>
        </div>
      ) : (
        /* Mobile / tablet (Figma "Mobile / Início") */
        <div className="relative flex min-h-[190px] overflow-hidden rounded-[28px] bg-gradient-to-br from-[#5a3a24] via-[#3a2417] to-card p-4">
          <div className="relative z-10 flex flex-1 flex-col gap-2 pr-2">
            <p className="text-xs font-bold">Bem-vindo à Kurio</p>
            <h1 className="text-lg leading-7 font-bold">
              SEJA DONO DA
              <br />
              CULTURA DIGITAL
            </h1>
            <p className="text-xs leading-4 text-muted-foreground">
              Descubra NFTs selecionados de criadores do mundo todo.
            </p>
            <Link
              to="/"
              hash="catalogo"
              className="inline-flex items-center gap-1 text-xs font-bold text-brand-accent"
            >
              EXPLORAR <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
            <Dots
              count={slides.length || 3}
              index={index}
              onSelect={setIndex}
              className="mt-auto self-center"
            />
          </div>
          <div className="relative w-[42%] max-w-[180px] shrink-0 self-center">
            {current ? (
              <NftImage image={current.image} sizes="180px" priority className="rounded-2xl" />
            ) : (
              <div className="shimmer aspect-square rounded-2xl" aria-hidden="true" />
            )}
          </div>
        </div>
      )}
      <p className="sr-only" aria-live="polite">
        {current ? `Slide ${index + 1} de ${slides.length}: ${current.name}` : ''}
      </p>
    </section>
  )
}

function Dots({
  count,
  index,
  onSelect,
  className,
}: {
  count: number
  index: number
  onSelect: (i: number) => void
  className?: string
}) {
  return (
    <div className={cn('flex gap-1', className)}>
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onSelect(i)}
          aria-label={`Mostrar destaque ${i + 1}`}
          aria-current={i === index ? 'true' : undefined}
          className="grid size-6 place-items-center rounded-full"
        >
          <span
            className={cn(
              'block size-2 rounded-full bg-primary transition',
              i === index ? 'scale-125' : 'opacity-50',
            )}
          />
        </button>
      ))}
    </div>
  )
}
