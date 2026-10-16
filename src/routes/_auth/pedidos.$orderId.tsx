import { createFileRoute } from '@tanstack/react-router'
import { OrderPage } from '@/features/orders/OrderPage'

export const Route = createFileRoute('/_auth/pedidos/$orderId')({
  head: () => ({ meta: [{ title: 'Pedido · Kurio' }] }),
  component: RouteComponent,
})

function RouteComponent() {
  const { orderId } = Route.useParams()
  return <OrderPage orderId={orderId} />
}
