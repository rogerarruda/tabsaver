export type Tab = { id?: number; title: string; url: string }
export type Collection = { name: string; tabs: Tab[]; date: string; key?: string; source?: unknown; renamed?: boolean; unreadableTabs?: boolean; tabsChanged?: boolean; favorite?: boolean; tags?: string[]; metadataChanged?: boolean }
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
      favorite: data.favorite === true,
      tags: Array.isArray(data.tags) ? data.tags.filter((tag): tag is string => typeof tag === 'string') : [],
      key: `stored-${index}`,
      source,
      unreadableTabs: !record(source) || result.unreadable,
    }
  })
}

export function writeCollections(collections: Collection[]): unknown[] {
  return collections.map(collection => {
    if (Object.prototype.hasOwnProperty.call(collection, 'source')) {
      if (record(collection.source)) return { ...collection.source, ...(collection.renamed ? { name: collection.name } : {}), ...(collection.tabsChanged ? { tabs: collection.tabs } : {}), ...(collection.metadataChanged ? { favorite: !!collection.favorite, tags: collection.tags || [] } : {}) }
      return collection.source
    }
    return { name: collection.name, tabs: collection.tabs, date: collection.date, ...(collection.tags?.length ? { tags: collection.tags } : {}), ...(collection.favorite ? { favorite: true } : {}) }
  })
}

export function appendTabs(collection: Collection, tabs: Tab[]): Collection {
  if (collection.unreadableTabs) throw new Error('Unreadable legacy tabs')
  return { ...collection, tabs: [...collection.tabs, ...tabs.map(({ title, url }) => ({ title, url }))], tabsChanged: true }
}

export function replaceTabs(collection: Collection, tabs: Tab[]): Collection {
  if (collection.unreadableTabs) throw new Error('Unreadable legacy tabs')
  return { ...collection, tabs, tabsChanged: true }
}
export function moveSavedTab(collections: Collection[], fromKey: string, toKey: string, index: number): Collection[] {
  const source = collections.find(c => c.key === fromKey), target = collections.find(c => c.key === toKey)
  if (!source || !target || fromKey === toKey || !source.tabs[index]) throw new Error('Invalid move')
  const from = replaceTabs(source, source.tabs.filter((_, i) => i !== index))
  const to = appendTabs(target, [source.tabs[index]])
  return collections.map(c => c.key === fromKey ? from : c.key === toKey ? to : c)
}
export function manualTab(title: string, address: string): Tab {
  const url = new URL(address.trim())
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid URL')
  return { title: title.trim() || url.hostname, url: url.href }
}

export function parseTags(text: string): string[] {
  const seen = new Set<string>()
  return text.split(',').map(tag => tag.trim().slice(0, 40)).filter(tag => { const key = tag.toLocaleLowerCase(); if (!tag || seen.has(key)) return false; seen.add(key); return true }).slice(0, 20)
}

export function urlKey(address: string): string {
  try { return new URL(address).href } catch { return address }
}
export function uniqueTabs(tabs: Tab[], existing: Tab[] = []): Tab[] {
  const seen = new Set(existing.map(tab => urlKey(tab.url)))
  return tabs.filter(tab => { const key = urlKey(tab.url); if (seen.has(key)) return false; seen.add(key); return true })
}
