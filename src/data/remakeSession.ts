import type { RemakeSource } from '../types'

const REMAKE_SESSION_KEY = 'framecraft.remake-source.v2'

function isRemakeSource(value: unknown): value is RemakeSource {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    (record.sourceType === 'history' || record.sourceType === 'trending') &&
    typeof record.businessId === 'string' &&
    typeof record.title === 'string' &&
    typeof record.sourceUrl === 'string'
  )
}

export function saveRemakeSelection(source: RemakeSource): void {
  window.sessionStorage.setItem(REMAKE_SESSION_KEY, JSON.stringify(source))
}

export function readRemakeSelection(): RemakeSource | null {
  const raw = window.sessionStorage.getItem(REMAKE_SESSION_KEY)
  if (!raw) return null
  try {
    const value: unknown = JSON.parse(raw)
    return isRemakeSource(value) ? value : null
  } catch {
    return null
  }
}

export function clearRemakeSelection(): void {
  window.sessionStorage.removeItem(REMAKE_SESSION_KEY)
}
