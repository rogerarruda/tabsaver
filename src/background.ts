// Resolve the page from the built manifest: Extension.js rewrites its path.
chrome.action.onClicked.addListener(async () => {
  try {
    const page = chrome.runtime.getManifest().chrome_url_overrides?.newtab
    if (!page) throw new Error('TabSaver page is missing from the manifest')
    const url = new URL(page, chrome.runtime.getURL('/')).href
    await chrome.tabs.create({ url })
  } catch (error) {
    console.error('Could not open TabSaver:', error)
  }
})
