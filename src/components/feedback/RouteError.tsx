import { Link, useRouter, type ErrorComponentProps } from '@tanstack/react-router'
import { CircleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { errorMessage } from './States'

/** Erro inesperado numa rota: mensagem no padrão visual e caminhos de recuperação. */
export function RouteError({ error, reset }: ErrorComponentProps) {
  const router = useRouter()
  return (
    <section
      role="alert"
      className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center"
    >
      <CircleAlert className="size-10 text-destructive" aria-hidden="true" />
      <h1 className="text-2xl font-bold">Algo deu errado</h1>
      <p className="text-muted-foreground">
        {errorMessage(error, 'Não foi possível exibir esta página.')}
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button
          onClick={() => {
            reset()
            void router.invalidate()
          }}
        >
          Tentar novamente
        </Button>
        <Button asChild variant="outline">
          <Link to="/">Voltar ao início</Link>
        </Button>
      </div>
    </section>
  )
}
