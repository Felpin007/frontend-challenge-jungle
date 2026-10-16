import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Renderiza o conteúdo abaixo da dobra só quando ele se aproxima da tela ou
 * quando o navegador fica ocioso. Divide a renderização inicial em tarefas
 * menores (menos bloqueio da thread principal em celulares). O espaço é
 * reservado com `minHeight` para não deslocar o layout.
 */
export function Deferred({ children, minHeight }: { children: ReactNode; minHeight: number }) {
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (visible) return
    const show = () => setVisible(true)
    const observer = new IntersectionObserver(
      (entries) => entries.some((e) => e.isIntersecting) && show(),
      {
        rootMargin: '600px',
      },
    )
    if (ref.current) observer.observe(ref.current)
    // Safari não tem requestIdleCallback: cai para um setTimeout
    const hasIdle = typeof window.requestIdleCallback === 'function'
    const idle = hasIdle
      ? window.requestIdleCallback(show, { timeout: 3000 })
      : setTimeout(show, 1500)
    return () => {
      observer.disconnect()
      if (hasIdle) window.cancelIdleCallback(idle as number)
      else clearTimeout(idle)
    }
  }, [visible])

  if (visible) return <>{children}</>
  return <div ref={ref} style={{ minHeight }} aria-hidden="true" />
}
