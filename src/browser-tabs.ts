import type { Tab, SavedGroup } from './collections'

export async function captureTabs(tabs: chrome.tabs.Tab[], getGroup?: (id: number) => Promise<chrome.tabGroups.TabGroup>): Promise<Tab[]> {
  const groups = new Map<number, SavedGroup>()
  const capture = crypto.randomUUID()
  if (getGroup) {
    const ids = [...new Set(tabs.map(tab => tab.groupId).filter((id): id is number => typeof id === 'number' && id >= 0))]
    await Promise.all(ids.map(async id => {
      const group = await getGroup(id)
      groups.set(id, { key: `${capture}:${id}`, title: group.title || '', color: group.color, collapsed: group.collapsed })
    }))
  }
  return tabs.filter(tab => tab.url).map(tab => ({ id: tab.id, title: tab.title || tab.url!, url: tab.url!, ...(groups.has(tab.groupId) ? { group: groups.get(tab.groupId)! } : {}) }))
}

export function createBrowserOpener(api: Pick<typeof chrome, 'tabs' | 'tabGroups'>, windowId?: number) {
  const groups = new Map<string, number>()
  let groupFailures = 0
  return {
    get groupFailures() { return groupFailures },
    async open(tab: Tab) {
      const created = await api.tabs.create({ url: tab.url, active: false, ...(windowId !== undefined ? { windowId } : {}) })
      if (tab.group && created.id !== undefined) {
        try {
          let id = groups.get(tab.group.key)
          if (id === undefined) {
            id = await api.tabs.group({ tabIds: created.id })
            groups.set(tab.group.key, id)
            await api.tabGroups.update(id, { title: tab.group.title, color: tab.group.color, collapsed: tab.group.collapsed })
          } else await api.tabs.group({ tabIds: created.id, groupId: id })
        } catch { groupFailures++ } // The page is already open; never create it a second time.
      }
      return true
    },
  }
}
