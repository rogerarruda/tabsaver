export async function writeAuxiliaryData(values: Record<string, unknown>) {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) { await chrome.storage.local.set(values); return }
  const mapped: Record<string, string> = {}
  for (const [key, value] of Object.entries(values)) mapped[key === 'collections' ? 'tabsaver-preview' : `tabsaver-${key}`] = JSON.stringify(value)
  const before = Object.keys(mapped).map(key => [key, localStorage.getItem(key)] as const)
  try { for (const [key, value] of Object.entries(mapped)) localStorage.setItem(key, value) }
  catch (error) { for (const [key, value] of before) { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value) } throw error }
}
export async function writeCollectionData(collections: unknown[], extra: Record<string, unknown> = {}) {
  await writeAuxiliaryData({ collections, ...extra })
}
