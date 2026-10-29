export async function writeCollectionData(collections: unknown[], extra: Record<string, unknown> = {}) {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    await chrome.storage.local.set({ collections, ...extra })
    return
  }
  const values: Record<string, string> = { 'tabsaver-preview': JSON.stringify(collections) }
  for (const [key, value] of Object.entries(extra)) values[`tabsaver-${key}`] = JSON.stringify(value)
  const before = Object.keys(values).map(key => [key, localStorage.getItem(key)] as const)
  try { for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value) }
  catch (error) { for (const [key, value] of before) { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value) } throw error }
}
