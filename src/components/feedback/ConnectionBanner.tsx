import { WifiOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useRealtimeStatus } from '@/realtime/status-store'

/**
 * Aviso de conexão em tempo real perdida. Só aparece se a reconexão demorar
 * mais de 1,5 s, para não piscar em quedas curtas.
 */
export function ConnectionBanner() {
  const status = useRealtimeStatus()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (status !== 'reconnecting') return
    const timer = setTimeout(() => setVisible(true), 1500)
    return () => {
      clearTimeout(timer)
      setVisible(false)
    }
  }, [status])

  return (
    <div aria-live="polite" className="sticky top-0 z-40">
      {visible ? (
        <p
          className="flex items-center justify-center gap-2 bg-amber px-4 py-2 text-sm font-medium text-primary-foreground"
          data-testid="realtime-banner"
        >
          <WifiOff className="size-4" aria-hidden="true" />
          Conexão em tempo real interrompida. Tentando reconectar…
        </p>
      ) : null}
    </div>
  )
}
