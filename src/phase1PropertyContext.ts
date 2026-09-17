export type Phase1PropertyContext = {
  id: string
  address: string
}

const STORAGE_KEY = 'shelter-prep.phase1.property-context.v1'

export function normalizeContextAddress(address: string) {
  return address.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function readPhase1PropertyContext(storage: Pick<Storage, 'getItem'>): Phase1PropertyContext | null {
  try {
    const value = JSON.parse(storage.getItem(STORAGE_KEY) || 'null')
    return typeof value?.id === 'string' && value.id && typeof value?.address === 'string' && value.address
      ? { id: value.id, address: value.address }
      : null
  } catch {
    return null
  }
}

export function writePhase1PropertyContext(storage: Pick<Storage, 'setItem'>, context: Phase1PropertyContext) {
  storage.setItem(STORAGE_KEY, JSON.stringify(context))
}

export function clearPhase1PropertyContext(storage: Pick<Storage, 'removeItem'>) {
  storage.removeItem(STORAGE_KEY)
}

export function propertyContextMatchesAddress(context: Phase1PropertyContext | null, address: string) {
  return Boolean(context && normalizeContextAddress(context.address) === normalizeContextAddress(address))
}
