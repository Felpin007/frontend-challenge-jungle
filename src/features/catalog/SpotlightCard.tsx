import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { NftImage } from '@/components/nft/NftImage'
import { formatEth } from '@/lib/money'
import { featuredQueryOptions } from './queries'

/** "NFT em destaque · Oferta limitada", abaixo dos filtros no desktop. */
export function SpotlightCard() {
  const { data } = useQuery(featuredQueryOptions())
  const nft = data?.spotlight
  return (
    <section
      aria-labelledby="spotlight-title"
      className="relative flex flex-col gap-4 overflow-hidden rounded-t-sm bg-gradient-to-b from-[#2f1d15] to-card pt-6"
    >
      <div className="flex flex-col gap-4 px-5">
        <h2 id="spotlight-title" className="text-2xl leading-6 font-bold text-brand-accent">
          NFT EM DESTAQUE
        </h2>
        <p className="text-center text-xl leading-4 font-bold">OFERTA LIMITADA</p>
      </div>
      {nft ? (
        <Link
          to="/nft/$nftId"
          params={{ nftId: nft.id }}
          className="group relative block overflow-hidden rounded-[22px]"
        >
          <NftImage
            image={nft.image}
            sizes="310px"
            className="transition group-hover:scale-[1.02]"
          />
          <span className="absolute inset-x-3 bottom-3 rounded-md bg-background/85 px-3 py-2 text-sm">
            {nft.name} · <span className="font-bold text-brand-accent">{formatEth(nft.price)}</span>
          </span>
        </Link>
      ) : (
        <div className="shimmer aspect-square w-full rounded-[22px]" aria-hidden="true" />
      )}
    </section>
  )
}
