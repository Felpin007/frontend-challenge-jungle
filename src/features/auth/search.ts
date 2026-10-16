import { z } from 'zod'

/**
 * Parâmetros de busca das rotas de login/cadastro. `redirect` guarda a página
 * de origem para retomar o fluxo após autenticar. Só aceitamos caminhos
 * internos ("/..."), evitando open redirect para outro domínio.
 */
export const authSearchSchema = z.object({
  redirect: z
    .string()
    .refine((v) => v.startsWith('/') && !v.startsWith('//'))
    .optional()
    .catch(undefined),
  reason: z.enum(['expired']).optional().catch(undefined),
})

export type AuthSearch = z.infer<typeof authSearchSchema>
