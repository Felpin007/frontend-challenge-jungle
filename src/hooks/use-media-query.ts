import { useSyncExternalStore } from 'react'

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(query)
      media.addEventListener('change', onChange)
      return () => media.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
  )
}

/** Mesmo breakpoint do cabeçalho desktop (lg = 1024 px). */
export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)')
