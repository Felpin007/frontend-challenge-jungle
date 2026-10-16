import { useLayoutEffect, useState } from 'react'

/**
 * Altura atual de um elemento (ResizeObserver), para reservar espaço sob painéis
 * fixos. Devolve um callback ref: funciona mesmo se o elemento montar depois.
 */
export function useElementHeight<T extends HTMLElement>() {
  const [element, setElement] = useState<T | null>(null)
  const [height, setHeight] = useState(0)
  useLayoutEffect(() => {
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      setHeight(Math.ceil(entry.borderBoxSize[0]?.blockSize ?? entry.contentRect.height))
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [element])
  return [setElement, element ? height : 0] as const
}
