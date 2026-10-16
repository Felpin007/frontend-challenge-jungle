import { createFileRoute } from '@tanstack/react-router'
import { Container } from '@/components/layout/Container'
import { CatalogSection, MobileSearchBar } from '@/features/catalog/CatalogSection'
import { featuredQueryOptions, nftListQueryOptions } from '@/features/catalog/queries'
import { catalogSearchSchema, toListQuery } from '@/features/catalog/search'
import { HeroCarousel } from '@/features/home/HeroCarousel'
import { BlogSection, PromoCards } from '@/features/home/EditorialSections'

export const Route = createFileRoute('/')({
  validateSearch: catalogSearchSchema,
  loaderDeps: ({ search }) => search,
  // Dispara as consultas assim que a rota é resolvida (inclusive no preload ao
  // passar o mouse em links). Não aguardamos: a página aparece com skeletons.
  loader: ({ context, deps }) => {
    void context.queryClient.prefetchQuery(nftListQueryOptions(toListQuery(deps)))
    void context.queryClient.prefetchQuery(featuredQueryOptions())
  },
  head: () => ({ meta: [{ title: 'Kurio · Marketplace de NFTs' }] }),
  component: HomePage,
})

function HomePage() {
  return (
    <Container className="flex flex-col gap-24 pt-6 lg:pt-8">
      <div className="flex flex-col gap-6 lg:gap-24">
        <MobileSearchBar />
        <HeroCarousel />
        <CatalogSection />
      </div>
      <PromoCards />
      <BlogSection />
    </Container>
  )
}
