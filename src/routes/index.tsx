import { createFileRoute } from '@tanstack/react-router'
import { Deferred } from '@/components/common/Deferred'
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
    <Container className="flex flex-col gap-24 pt-10 lg:pt-8">
      {/* Mobile (Figma): busca, destaque, abas e grade separados por 16 px */}
      <div className="flex flex-col gap-4 lg:gap-24">
        <MobileSearchBar />
        <HeroCarousel />
        <CatalogSection />
      </div>
      <Deferred minHeight={250}>
        <PromoCards />
      </Deferred>
      <Deferred minHeight={480}>
        <BlogSection />
      </Deferred>
    </Container>
  )
}
