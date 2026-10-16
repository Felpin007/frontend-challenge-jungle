import { Eye, EyeOff } from 'lucide-react'
import { useId, useState, type ComponentProps, type ReactNode } from 'react'
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export interface FieldControlProps {
  id: string
  'aria-invalid': boolean
  'aria-describedby': string | undefined
  'aria-required'?: boolean
}

/**
 * Campo de formulário acessível: label associado, asterisco de obrigatório,
 * dica e mensagem de erro ligadas ao input por aria-describedby.
 */
export function Field({
  label,
  required,
  error,
  hint,
  className,
  labelClassName,
  srOnlyLabel,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  hint?: string
  className?: string
  labelClassName?: string
  srOnlyLabel?: boolean
  children: (props: FieldControlProps) => ReactNode
}) {
  const id = useId()
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const describedBy =
    [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Label
        htmlFor={id}
        className={cn('text-base font-normal', srOnlyLabel && 'sr-only', labelClassName)}
      >
        {label}
        {required ? (
          <span className="text-brand-coral" aria-hidden="true">
            *
          </span>
        ) : null}
      </Label>
      {children({
        id,
        'aria-invalid': Boolean(error),
        'aria-describedby': describedBy,
        'aria-required': required || undefined,
      })}
      {hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function PasswordInput({ className, ...props }: ComponentProps<typeof Input>) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <Input type={visible ? 'text' : 'password'} className={cn('pr-11', className)} {...props} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-sm text-brand-secondary hover:text-foreground"
        aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
        aria-pressed={visible}
      >
        {visible ? (
          <Eye className="size-5" aria-hidden="true" />
        ) : (
          <EyeOff className="size-5" aria-hidden="true" />
        )}
      </button>
    </div>
  )
}

/** Mensagem de erro geral do formulário (anunciada por leitores de tela). */
export function FormError({ message }: { message?: string | null }) {
  if (!message) return null
  return (
    <p
      role="alert"
      className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      {message}
    </p>
  )
}

/** Aplica os erros por campo devolvidos pela API (422/409) no react-hook-form. */
export function applyServerErrors<T extends FieldValues>(
  fieldErrors: Record<string, string>,
  setError: UseFormSetError<T>,
  fields: Array<Path<T>>,
): boolean {
  let applied = false
  for (const [name, message] of Object.entries(fieldErrors)) {
    const key = (name.split('.').pop() ?? name) as Path<T>
    if (fields.includes(key)) {
      setError(key, { type: 'server', message }, { shouldFocus: !applied })
      applied = true
    }
  }
  return applied
}
