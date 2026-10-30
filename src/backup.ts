import { writeAuxiliaryData } from './collection-storage'
import { readCollections } from './collections'
import { readTrash } from './trash'
import type { TrashEntry } from './trash'

export type BackupPreferences = { language: 'auto' | 'pt-BR' | 'en'; theme: 'system' | 'light' | 'dark' }
export type Snapshot = { collections: unknown[]; preferences: BackupPreferences; trash?: TrashEntry[] }
export type Backup = Snapshot & { app: 'tabsaver'; version: 1; exportedAt: string }
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)
export function validateSnapshot(input: unknown): Snapshot {
  if (!object(input) || !Array.isArray(input.collections) || !object(input.preferences)) throw new Error('invalid')
  const p = input.preferences
  if (typeof p.language !== 'string' || typeof p.theme !== 'string' || !['auto', 'pt-BR', 'en'].includes(p.language) || !['system', 'light', 'dark'].includes(p.theme)) throw new Error('invalid')
  return { collections: input.collections, preferences: { language: p.language as BackupPreferences['language'], theme: p.theme as BackupPreferences['theme'] }, ...(input.trash !== undefined ? { trash: readTrash(input.trash) } : {}) }
}
export function createBackup(snapshot: Snapshot): Backup {
  return { ...validateSnapshot(snapshot), app: 'tabsaver', version: 1, exportedAt: new Date().toISOString() }
}
export function parseBackup(text: string): Backup {
  const value: unknown = JSON.parse(text)
  if (!object(value) || value.app !== 'tabsaver' || value.version !== 1 || typeof value.exportedAt !== 'string' || !Number.isFinite(Date.parse(value.exportedAt))) throw new Error('invalid')
  return { ...validateSnapshot(value), app: 'tabsaver', version: 1, exportedAt: value.exportedAt }
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (object(value)) return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`
  return JSON.stringify(value) ?? 'null'
}
export function mergeCollections(current: unknown[], incoming: unknown[]): unknown[] {
  const result = [...current], seen = new Set(current.map(canonical))
  for (const item of incoming) { const key = canonical(item); if (!seen.has(key)) { result.push(item); seen.add(key) } }
  return result
}
export function summarizeBackup(backup: Snapshot) {
  const collections = readCollections(backup.collections)
  return { collections: collections.length, tabs: collections.reduce((sum, c) => sum + c.tabs.length, 0), unreadable: collections.some(c => c.unreadableTabs) }
}

const extension = () => typeof chrome !== 'undefined' && !!chrome.storage?.local
const defaults: BackupPreferences = { language: 'auto', theme: 'system' }
export async function readBackupStorage(): Promise<Snapshot & { backupRecovery?: Snapshot | null }> {
  if (extension()) {
    const data = await chrome.storage.local.get({ collections: [], preferences: defaults, trash: [], backupRecovery: null })
    return { ...validateSnapshot(data), backupRecovery: data.backupRecovery }
  }
  return { ...validateSnapshot({ collections: JSON.parse(localStorage.getItem('tabsaver-preview') || '[]'), preferences: JSON.parse(localStorage.getItem('tabsaver-preferences') || JSON.stringify(defaults)), trash: JSON.parse(localStorage.getItem('tabsaver-trash') || '[]') }), backupRecovery: JSON.parse(localStorage.getItem('tabsaver-recovery') || 'null') }
}
export async function writeBackupStorage(snapshot: Snapshot, recovery: Snapshot | null) {
  const valid = validateSnapshot(snapshot)
  await writeAuxiliaryData({ ...valid, backupRecovery: recovery, lastDeleted: null })
}

export type BackupMarker = { fingerprint?: string; date?: string; snoozeUntil?: number }
export async function backupFingerprint(snapshot: Snapshot): Promise<string> {
  const bytes = new TextEncoder().encode(canonical(snapshot))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('')
}
export async function readBackupMarker(): Promise<BackupMarker> {
  const raw = extension() ? (await chrome.storage.local.get({ backupMarker: {} })).backupMarker : JSON.parse(localStorage.getItem('tabsaver-backupMarker') || '{}')
  return object(raw) ? raw : {}
}
export async function writeBackupMarker(marker: BackupMarker) {
  if (extension()) await chrome.storage.local.set({ backupMarker: marker })
  else localStorage.setItem('tabsaver-backupMarker', JSON.stringify(marker))
}
export async function markBackupExport(snapshot: Snapshot) {
  await writeBackupMarker({ fingerprint: await backupFingerprint(snapshot), date: new Date().toISOString(), snoozeUntil: 0 })
}
