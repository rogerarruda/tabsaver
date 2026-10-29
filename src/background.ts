import { manualTab, quickSave } from './collections'

async function openPage() {
  const page = chrome.runtime.getManifest().chrome_url_overrides?.newtab
  if (!page) throw new Error('TabSaver page is missing from the manifest')
  await chrome.tabs.create({ url: new URL(page, chrome.runtime.getURL('/')).href })
}
chrome.action.onClicked.addListener(() => openPage().catch(error => console.error('Could not open TabSaver:', error)))

async function menuLanguage() {
  const { preferences } = await chrome.storage.local.get({ preferences: { language: 'auto' } })
  return preferences.language === 'pt-BR' || (preferences.language === 'auto' && navigator.language.toLowerCase().startsWith('pt'))
}
async function registerMenus() {
  try {
    const portuguese = await menuLanguage()
    await chrome.contextMenus.removeAll()
    chrome.contextMenus.create({ id: 'tabsaver-page', title: portuguese ? 'Salvar esta aba no TabSaver' : 'Save this tab to TabSaver', contexts: ['page', 'action'], documentUrlPatterns: ['http://*/*', 'https://*/*'] })
    chrome.contextMenus.create({ id: 'tabsaver-link', title: portuguese ? 'Salvar link no TabSaver' : 'Save link to TabSaver', contexts: ['link'], targetUrlPatterns: ['http://*/*', 'https://*/*'] })
  } catch (error) { console.error('Could not register TabSaver menus:', error) }
}
chrome.runtime.onInstalled.addListener(registerMenus)
chrome.runtime.onStartup.addListener(registerMenus)
chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && changes.preferences) registerMenus() })
let queue = Promise.resolve()
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!['tabsaver-page', 'tabsaver-link'].includes(String(info.menuItemId))) return
  queue = queue.then(async () => {
    try {
      const address = info.menuItemId === 'tabsaver-link' ? info.linkUrl : tab?.url || info.pageUrl
      const savedTab = manualTab(info.menuItemId === 'tabsaver-link' ? info.linkUrl || '' : tab?.title || '', address || '')
      const data = await chrome.storage.local.get({ collections: [] })
      if (!Array.isArray(data.collections)) throw new Error('Invalid collections')
      const name = await menuLanguage() ? 'Salvos rápidos' : 'Quick saves'
      await chrome.storage.local.set({ collections: quickSave(data.collections, savedTab, name) })
      await chrome.action.setBadgeBackgroundColor({ color: '#2c543f' })
      await chrome.action.setBadgeText({ text: '✓' })
      setTimeout(() => chrome.action.setBadgeText({ text: '' }).catch(() => {}), 4000)
    } catch (error) {
      console.error('Could not quick-save tab:', error)
      await chrome.action.setBadgeBackgroundColor({ color: '#a74332' }).catch(() => {})
      await chrome.action.setBadgeText({ text: '!' }).catch(() => {})
    }
  }).catch(error => console.error('Quick-save failed:', error))
})
