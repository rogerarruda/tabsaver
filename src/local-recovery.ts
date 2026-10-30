import { readCollections } from './collections'
import { readTrash } from './trash'
import type { TrashEntry } from './trash'
export type LocalRecovery = { id: string; date: string; collections: unknown[]; trash: TrashEntry[] }
export function readRecoveries(value: unknown): LocalRecovery[] {
  if (!Array.isArray(value)) throw new Error('Invalid recovery history')
  for (const item of value) {
    if (!item || typeof item.id !== 'string' || typeof item.date !== 'string' || !Number.isFinite(Date.parse(item.date))) throw new Error('Invalid recovery point')
    readCollections(item.collections); readTrash(item.trash)
  }
  return value
}
export function captureRecovery(history: unknown, collections: unknown, trash: unknown): LocalRecovery[] {
  const previous = readRecoveries(history)
  readCollections(collections)
  const state = { collections: collections as unknown[], trash: readTrash(trash) }
  if (previous[0] && JSON.stringify({ collections: previous[0].collections, trash: previous[0].trash }) === JSON.stringify(state)) return previous
  const result: LocalRecovery[] = JSON.parse(JSON.stringify([{ id: crypto.randomUUID(), date: new Date().toISOString(), ...state }, ...previous].slice(0, 5)))
  // Limit accumulated copies. Keep at least the most recent point, even for a large library.
  while (result.length > 1 && new TextEncoder().encode(JSON.stringify(result)).length > 4 * 1024 * 1024) result.pop()
  return result
}
export async function readLocalRecoveries(): Promise<LocalRecovery[]> {
  const raw = typeof chrome !== 'undefined' && chrome.storage?.local ? (await chrome.storage.local.get({ localRecoveries: [] })).localRecoveries : JSON.parse(localStorage.getItem('tabsaver-localRecoveries') || '[]')
  return readRecoveries(raw)
}
