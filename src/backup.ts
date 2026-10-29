import { readCollections } from './collections'

export type BackupPreferences = { language: 'auto' | 'pt-BR' | 'en'; theme: 'system' | 'light' | 'dark' }
export type Snapshot = { collections: unknown[]; preferences: BackupPreferences }
export type Backup = Snapshot & { app: 'tabsaver'; version: 1; exportedAt: string }
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)
export function validateSnapshot(input: unknown): Snapshot {
  if (!object(input) || !Array.isArray(input.collections) || !object(input.preferences)) throw new Error('invalid')
  const p = input.preferences
  if (typeof p.language !== 'string' || typeof p.theme !== 'string' || !['auto', 'pt-BR', 'en'].includes(p.language) || !['system', 'light', 'dark'].includes(p.theme)) throw new Error('invalid')
  return { collections: input.collections, preferences: { language: p.language as BackupPreferences['language'], theme: p.theme as BackupPreferences['theme'] } }
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
    const data = await chrome.storage.local.get({ collections: [], preferences: defaults, backupRecovery: null })
    return { ...validateSnapshot(data), backupRecovery: data.backupRecovery }
  }
  return { ...validateSnapshot({ collections: JSON.parse(localStorage.getItem('tabsaver-preview') || '[]'), preferences: JSON.parse(localStorage.getItem('tabsaver-preferences') || JSON.stringify(defaults)) }), backupRecovery: JSON.parse(localStorage.getItem('tabsaver-recovery') || 'null') }
}
export async function writeBackupStorage(snapshot: Snapshot, recovery: Snapshot | null) {
  const valid = validateSnapshot(snapshot)
  if (extension()) { await chrome.storage.local.set({ ...valid, backupRecovery: recovery }); return }
  const values = { 'tabsaver-preview': JSON.stringify(valid.collections), 'tabsaver-preferences': JSON.stringify(valid.preferences), 'tabsaver-recovery': JSON.stringify(recovery) }
  const before = Object.keys(values).map(key => [key, localStorage.getItem(key)] as const)
  try { for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value) }
  catch (error) { for (const [key, value] of before) { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value) } throw error }
}
