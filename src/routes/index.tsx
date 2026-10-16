import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { nftApi } from '@/api/endpoints'
import { queryKeys } from '@/api/query-keys'
import { useRealtimeStatus } from '@/realtime/status-store'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  const status = useRealtimeStatus()
  const query = { page: 1 }
  const list = useQuery({
    queryKey: queryKeys.nfts.list(query),
    queryFn: ({ signal }) => nftApi.list(query, { signal }),
  })
  return (
    <main className="p-8">
      <p data-testid="realtime-status">realtime: {status}</p>
      {list.data?.items.map((nft) => (
        <p key={nft.id} data-testid="nft-price" data-nft={nft.id}>
          {nft.name} {nft.price}
        </p>
      ))}
    </main>
  )
}
