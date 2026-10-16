import { createFileRoute } from '@tanstack/react-router'
import { nftDetailQueryOptions } from '@/features/catalog/queries'
import { NftDetailPage } from '@/features/nft/NftDetailPage'

export const Route = createFileRoute('/nft/$nftId')({
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(nftDetailQueryOptions(params.nftId))
  },
  head: () => ({ meta: [{ title: 'Detalhes do NFT · Kurio' }] }),
  component: RouteComponent,
})

function RouteComponent() {
  const { nftId } = Route.useParams()
  // `key` garante estado limpo (edição/quantidade) ao navegar entre NFTs.
  return <NftDetailPage key={nftId} nftId={nftId} />
}
