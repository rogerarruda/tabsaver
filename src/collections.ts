export type Tab = { id?: number; title: string; url: string }
export type Collection = { name: string; tabs: Tab[]; date: string; key?: string; source?: unknown; renamed?: boolean; unreadableTabs?: boolean }
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)

function readTabs(input: unknown): { tabs: Tab[]; unreadable: boolean } {
  let value = input
  if (typeof value === 'string') {
    try { value = JSON.parse(value) } catch { return { tabs: [], unreadable: true } }
  }
  if (value === undefined || value === null) return { tabs: [], unreadable: value === null }
  if (record(value)) value = typeof value.url === 'string' ? [value] : Object.values(value)
  if (!Array.isArray(value)) return { tabs: [], unreadable: true }
  const tabs: Tab[] = []
  let unreadable = false
  for (const item of value) {
    if (record(item) && typeof item.url === 'string' && item.url.trim()) {
      tabs.push({ url: item.url, title: typeof item.title === 'string' && item.title ? item.title : item.url })
    } else if (typeof item === 'string' && /^https?:\/\//i.test(item)) {
      tabs.push({ url: item, title: item })
    } else unreadable = true
  }
  return { tabs, unreadable }
}

// Normalize the view only. Keep every original entry for subsequent writes.
export function readCollections(input: unknown): Collection[] {
  if (!Array.isArray(input)) throw new Error('Invalid collections container')
  return input.map((source, index) => {
    const data = record(source) ? source : {}
    const result = readTabs(data.tabs)
    return {
      name: typeof data.name === 'string' ? data.name : `Collection ${index + 1}`,
      date: typeof data.date === 'string' ? data.date : typeof data.date === 'number' && Number.isFinite(new Date(data.date).getTime()) ? new Date(data.date).toISOString() : '',
      tabs: result.tabs,
      key: `stored-${index}`,
      source,
      unreadableTabs: !record(source) || result.unreadable,
    }
  })
}

export function writeCollections(collections: Collection[]): unknown[] {
  return collections.map(collection => {
    if (Object.prototype.hasOwnProperty.call(collection, 'source')) {
      return collection.renamed && record(collection.source) ? { ...collection.source, name: collection.name } : collection.source
    }
    return { name: collection.name, tabs: collection.tabs, date: collection.date }
  })
}
