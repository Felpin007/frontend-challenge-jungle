/**
 * Protege o cliente contra entregas duplicadas e fora de ordem.
 * - eventId já processado: ignora (duplicata).
 * - versão menor ou igual à última aplicada para o recurso: ignora (evento antigo).
 * A versão também é comparada com a do cache (dado vindo do REST), no handler.
 */
const MAX_REMEMBERED = 500

export class EventGuard {
  private seen = new Set<string>()
  private order: string[] = []
  private versions = new Map<string, number>()

  accept(event: {
    eventId: string
    resource: { type: string; id: string }
    version: number
  }): boolean {
    if (this.seen.has(event.eventId)) return false
    const key = `${event.resource.type}:${event.resource.id}`
    const last = this.versions.get(key) ?? -1
    this.remember(event.eventId)
    if (event.version <= last) return false
    this.versions.set(key, event.version)
    return true
  }

  private remember(id: string) {
    this.seen.add(id)
    this.order.push(id)
    if (this.order.length > MAX_REMEMBERED) this.seen.delete(this.order.shift()!)
  }
}
