import { Container } from '@/components/layout/Container'

/** Mesmo esqueleto do detalhe (galeria + informações), evitando deslocamento de layout. */
export function DetailSkeleton() {
  return (
    <Container
      className="flex flex-col gap-6 pt-6 lg:flex-row lg:gap-8 lg:pt-[72px]"
      aria-busy="true"
    >
      <p className="sr-only" role="status">
        Carregando NFT…
      </p>
      <div className="flex flex-col-reverse gap-4 lg:flex-row lg:gap-7" aria-hidden="true">
        <div className="flex gap-3 lg:flex-col lg:gap-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="shimmer size-16 rounded-sm lg:size-[100px]" />
          ))}
        </div>
        <div
          className="shimmer aspect-square w-full rounded-[24px] lg:size-[444px]"
          data-testid="detail-skeleton"
        />
      </div>
      <div className="flex flex-1 flex-col gap-4" aria-hidden="true">
        <div className="shimmer h-9 w-2/3 rounded-sm" />
        <div className="shimmer h-7 w-1/4 rounded-sm" />
        <div className="shimmer h-20 w-full rounded-sm" />
        <div className="shimmer h-8 w-1/2 rounded-full" />
        <div className="shimmer h-12 w-full rounded-sm" />
        <div className="shimmer h-24 w-2/3 rounded-sm" />
      </div>
    </Container>
  )
}
