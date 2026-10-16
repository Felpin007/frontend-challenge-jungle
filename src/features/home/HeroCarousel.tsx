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
        /* Mobile / tablet (Figma "Mobile / Início", "Hero Banner" de 366 × 190) */
        <div className="relative isolate flex min-h-[190px] gap-2 overflow-hidden rounded-[30px] bg-[linear-gradient(to_bottom_right,rgb(210_138_76/0.2),rgb(210_138_76/0.1))] px-4 pt-[5px] pb-[29px]">
          {/* Elipses decorativas do Figma (Ellipse 49 e 50) */}
          <span
            className="absolute top-[-31px] left-[-80px] -z-10 size-[248px] rounded-full bg-[linear-gradient(160deg,rgb(221_154_95/0.43),rgb(210_138_76/0.04))]"
            aria-hidden="true"
          />
          <span
            className="absolute top-[-10px] left-[73px] -z-10 size-[248px] rounded-full bg-[linear-gradient(160deg,rgb(221_154_95/0.37),rgb(210_138_76/0))]"
            aria-hidden="true"
          />
          <div className="flex min-w-0 flex-1 flex-col sm:max-w-[320px]">
            <p className="text-xs leading-4 font-medium">Bem-vindo à Kurio</p>
            {/* Quebra balanceada em vez de <br>: igual ao Figma no tamanho padrão e sem
                virar 4 linhas quando o sistema usa fonte maior */}
            <h1 className="mt-1.5 text-lg leading-[1.6] font-bold text-balance">
              SEJA DONO DA CULTURA DIGITAL
            </h1>
            <p className="mt-1.5 max-w-[188px] text-xs leading-[18px] text-muted-foreground sm:max-w-none">
              Descubra NFTs selecionados de criadores do mundo todo.
            </p>
            <Link
              to="/"
              hash="catalogo"
              className="inline-flex h-4 items-center gap-2 self-start text-xs leading-[14px] font-bold text-brand-accent"
            >
              EXPLORAR{' '}
              <ArrowRight className="size-4 text-primary" strokeWidth={1.5} aria-hidden="true" />
            </Link>
          </div>
          {/* 138 px em 414 (Figma); encolhe até 118 px para o texto manter 3 linhas em 390 */}
          <div className="relative mt-1.5 size-[clamp(118px,calc(100vw-276px),138px)] shrink-0 sm:size-[180px]">
            {current ? (
              <NftImage image={current.image} sizes="180px" priority className="rounded-2xl" />
            ) : (
              <div className="shimmer size-full rounded-2xl" aria-hidden="true" />
            )}
            {/* Miniatura do próximo destaque sobre o canto inferior esquerdo (Figma) */}
            {slides.length > 1 ? (
              <div className="absolute -bottom-2 left-3.5 size-[58px] overflow-hidden rounded-2xl sm:size-[76px]">
                <NftImage image={slides[(index + 1) % slides.length].image} alt="" sizes="80px" />
              </div>
            ) : null}
          </div>
          {/* Pontos do Figma (7 px, a cada 13 px) num único botão: área de toque de 49 × 24 px */}
          <button
            type="button"
            onClick={() => setIndex((index + 1) % (slides.length || 1))}
            aria-label={`Próximo destaque (${index + 1} de ${slides.length || 3})`}
            className="absolute -bottom-0.5 left-1/2 flex h-6 -translate-x-1/2 items-center gap-1.5 rounded-full px-2"
          >
            {Array.from({ length: slides.length || 3 }, (_, i) => (
              <span
                key={i}
                className={cn('size-[7px] rounded-full bg-primary', i !== index && 'opacity-55')}
                aria-hidden="true"
              />
            ))}
          </button>
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
