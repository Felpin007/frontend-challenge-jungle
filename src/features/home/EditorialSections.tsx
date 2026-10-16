import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { ComingSoon } from '@/components/common/ComingSoon'
import { NftImage } from '@/components/nft/NftImage'

const art = (name: string, alt: string) => ({ src: `/nfts/${name}-800.webp`, alt })

/** Cards promocionais: levam a recortes reais do catálogo. */
export function PromoCards() {
  const promos = [
    {
      title: 'Lançamentos gênesis de edição limitada',
      text: 'Colecione edições escassas diretamente dos criadores antes da revelação pública.',
      image: art('emerald-ape', 'Macaco com óculos verdes e jaqueta college'),
      search: { tab: 'new' as const },
    },
    {
      title: 'Arte digital selecionada e muito mais',
      text: 'Explore novos artistas, coleções verificadas e obras digitais que definem a cultura.',
      image: art('ivory-baron', 'Macaco de blazer marfim e gola alta verde'),
      search: { categories: 'arte-digital' },
    },
  ]
  return (
    <section
      aria-label="Coleções em destaque"
      className="grid gap-7 [contain-intrinsic-size:auto_250px] [content-visibility:auto] md:grid-cols-2"
    >
      {promos.map((promo) => (
        <article key={promo.title} className="flex overflow-hidden rounded-lg bg-card">
          <div className="w-1/2 shrink-0 overflow-hidden rounded-[18px]">
            <NftImage
              image={promo.image}
              sizes="(min-width: 768px) 290px, 50vw"
              className="h-full"
            />
          </div>
          <div className="flex flex-1 flex-col items-end gap-3 p-4 text-right sm:p-7">
            <h2 className="text-base leading-6 font-bold sm:text-lg">{promo.title}</h2>
            <p className="text-sm leading-6 text-muted-foreground">{promo.text}</p>
            <Link
              to="/"
              search={promo.search}
              hash="catalogo"
              className="mt-auto inline-flex h-10 items-center gap-1 rounded-md bg-primary px-6 font-medium text-primary-foreground hover:bg-primary/90"
            >
              Explorar <ArrowRight className="size-4" aria-hidden="true" />
              <span className="sr-only">{promo.title}</span>
            </Link>
          </div>
        </article>
      ))}
    </section>
  )
}

const POSTS = [
  {
    date: '12 de setembro',
    read: '6 min',
    title: 'Como funciona a propriedade de NFTs',
    text: 'Aprenda a colecionar, negociar e verificar ativos digitais.',
    image: art('ivory-baron', ''),
  },
  {
    date: '13 de setembro',
    read: '2 min',
    title: '10 artistas digitais para acompanhar',
    text: 'Conheça criadores que moldam a cultura digital.',
    image: art('emerald-ape', ''),
  },
  {
    date: '15 de setembro',
    read: '3 min',
    title: 'Raridade, atributos e procedência',
    text: 'Entenda raridade, procedência, direitos autorais e utilidade.',
    image: art('sage-nomad', ''),
  },
  {
    date: '15 de setembro',
    read: '2 min',
    title: 'Como proteger sua carteira',
    text: 'Proteja sua carteira, seus ativos e sua identidade.',
    image: art('golden-beat', ''),
  },
]

/** "Diário da Cunhagem": conteúdo editorial está fora do escopo, então "Ler mais" fica desabilitado. */
export function BlogSection() {
  return (
    <section
      aria-labelledby="blog-title"
      className="flex flex-col gap-10 [contain-intrinsic-size:auto_480px] [content-visibility:auto]"
    >
      <header className="flex flex-col gap-3 text-center">
        <h2 id="blog-title" className="text-[28px] leading-9 font-bold">
          Diário da Cunhagem
        </h2>
        <p className="text-sm text-muted-foreground">
          Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.
        </p>
      </header>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {POSTS.map((post) => (
          <article key={post.title} className="flex flex-col overflow-hidden rounded-lg bg-card">
            <div className="h-[195px] overflow-hidden">
              <NftImage
                image={post.image}
                alt=""
                sizes="(min-width: 1024px) 268px, 50vw"
                className="h-full"
              />
            </div>
            <div className="flex flex-1 flex-col gap-2 px-4 pt-3 pb-4">
              <p className="text-xs font-medium text-muted-foreground">
                <time>{post.date}</time> <span aria-hidden="true">|</span> Leitura de {post.read}
              </p>
              <h3 className="text-base leading-[21px] font-bold">{post.title}</h3>
              <p className="text-xs font-medium text-muted-foreground">{post.text}</p>
              <ComingSoon
                className="mt-auto text-xs font-bold text-brand-accent"
                label="Artigos disponíveis em breve"
              >
                Ler mais →
              </ComingSoon>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
