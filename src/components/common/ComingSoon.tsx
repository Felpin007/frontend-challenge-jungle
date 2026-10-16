import type { ReactNode } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

/**
 * Ação fora do escopo da entrega (páginas editoriais, suporte, atividade...).
 * Fica visível para manter o layout, mas desabilitada e com explicação, para
 * não aparentar sucesso funcional.
 */
export function ComingSoon({
  children,
  className,
  label = 'Disponível em breve',
}: {
  children: ReactNode
  className?: string
  label?: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-disabled="true"
          aria-describedby={undefined}
          onClick={(e) => e.preventDefault()}
          className={cn('cursor-not-allowed text-left opacity-80', className)}
        >
          {children}
          <span className="sr-only"> ({label})</span>
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
