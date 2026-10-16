import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

/** Largura do layout no Figma: 1200 px centralizados (margens de 120 px em 1440). */
export function Container({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('mx-auto w-full max-w-[1248px] px-4 sm:px-6', className)} {...props} />
}
