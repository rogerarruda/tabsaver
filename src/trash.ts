import { readCollections, writeCollections, replaceTabs } from './collections'
import type { Collection, Tab } from './collections'
export type TrashEntry = { id: string; kind: 'collection' | 'tab'; deletedAt: string; source: unknown; position: number; tab?: Tab }
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
export function readTrash(value: unknown): TrashEntry[] {
  if (!Array.isArray(value)) throw new Error('Invalid trash')
  const ids = new Set<string>()
  for (const entry of value) {
    if (!object(entry) || typeof entry.id !== 'string' || !entry.id || ids.has(entry.id) || (entry.kind !== 'collection' && entry.kind !== 'tab') || typeof entry.deletedAt !== 'string' || !Number.isFinite(Date.parse(entry.deletedAt)) || !Number.isInteger(entry.position) || Number(entry.position) < 0 || !Object.prototype.hasOwnProperty.call(entry, 'source')) throw new Error('Invalid trash entry')
    if (entry.kind === 'tab' && (!object(entry.tab) || typeof entry.tab.url !== 'string' || typeof entry.tab.title !== 'string')) throw new Error('Invalid deleted tab')
    ids.add(entry.id)
  }
  return value as TrashEntry[]
}
export function deletedCollection(collection: Collection, position: number): TrashEntry {
  return { id: crypto.randomUUID(), kind: 'collection', deletedAt: new Date().toISOString(), source: writeCollections([collection])[0], position }
}
export function deletedTab(collection: Collection, index: number): TrashEntry {
  if (collection.unreadableTabs || !collection.tabs[index]) throw new Error('Invalid deleted tab')
  const raw = writeCollections([collection])[0]
  return { id: crypto.randomUUID(), kind: 'tab', deletedAt: new Date().toISOString(), source: { ...(object(raw) ? raw : {}), tabs: [] }, position: index, tab: { ...collection.tabs[index] } }
}
export function restoreDeleted(collections: Collection[], entry: TrashEntry): Collection[] {
  readTrash([entry])
  const raw = writeCollections(collections)
  if (entry.kind === 'collection') { raw.splice(Math.min(entry.position, raw.length), 0, entry.source); return readCollections(raw) }
  const original = object(entry.source) ? entry.source : {}
  const matches = collections.filter(c => {
    const source = object(c.source) ? c.source : {}
    return original.id !== undefined ? source.id === original.id : typeof original.name === 'string' && typeof original.date === 'string' && source.name === original.name && source.date === original.date
  })
  if (matches.length === 1 && !matches[0].unreadableTabs) {
    const target = matches[0], tabs = [...target.tabs]
    tabs.splice(Math.min(entry.position, tabs.length), 0, entry.tab!)
    return collections.map(c => c.key === target.key ? replaceTabs(c, tabs) : c)
  }
  // Recreate the container if its original destination is gone or ambiguous.
  return readCollections([...raw, { ...original, tabs: [entry.tab], date: typeof original.date === 'string' ? original.date : new Date().toISOString() }])
}
export function migrateLastDeleted(trash: TrashEntry[], previous: unknown): TrashEntry[] {
  if (!object(previous) || !Object.prototype.hasOwnProperty.call(previous, 'entry')) return trash
  if (trash.some(entry => entry.kind === 'collection' && JSON.stringify(entry.source) === JSON.stringify(previous.entry))) return trash
  const id = trash.some(entry => entry.id === 'legacy-last-deleted') ? crypto.randomUUID() : 'legacy-last-deleted'
  return [...trash, { id, kind: 'collection', deletedAt: new Date().toISOString(), source: previous.entry, position: Number.isInteger(previous.index) && Number(previous.index) >= 0 ? Number(previous.index) : 0 }]
}
export function mergeTrash(current: TrashEntry[], incoming: TrashEntry[]): TrashEntry[] {
  const result = [...readTrash(current)], ids = new Set(current.map(entry => entry.id))
  for (const entry of readTrash(incoming)) {
    const existing = result.find(item => item.id === entry.id)
    if (existing && JSON.stringify(existing) === JSON.stringify(entry)) continue
    const item = ids.has(entry.id) ? { ...entry, id: crypto.randomUUID() } : entry
    result.push(item); ids.add(item.id)
  }
  return result
}
