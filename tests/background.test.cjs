const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')

test('toolbar icon opens the page resolved from the production manifest', async () => {
  const manifest = JSON.parse(fs.readFileSync('dist/chrome/manifest.json', 'utf8'))
  assert.ok(manifest.action)
  assert.ok(manifest.background.service_worker)
  assert.equal(manifest.action.default_popup, undefined)
  assert.ok(fs.existsSync(`dist/chrome/${manifest.chrome_url_overrides.newtab}`))
  let listener
  const created = []
  const chrome = {
    action: { onClicked: { addListener: cb => listener = cb } },
    contextMenus: { onClicked: { addListener: () => {} } },
    storage: { onChanged: { addListener: () => {} } },
    runtime: { getManifest: () => manifest, getURL: () => 'chrome-extension://test-id/', onInstalled: { addListener: () => {} }, onStartup: { addListener: () => {} } },
    tabs: { create: async options => created.push(options) },
  }
  const code = fs.readFileSync(`dist/chrome/${manifest.background.service_worker}`, 'utf8')
  vm.runInNewContext(code, { chrome, URL, console })
  await listener()
  assert.equal(created.length, 1)
  assert.equal(created[0].url, `chrome-extension://test-id/${manifest.chrome_url_overrides.newtab}`)
  assert.equal(created[0].url.includes('chrome://newtab'), false)
})

test('context menu registers localized actions and saves a page without closing it', async () => {
  const manifest = JSON.parse(fs.readFileSync('dist/chrome/manifest.json', 'utf8'))
  let installed, clicked, saved
  const menus = [], data = { collections: [], preferences: { language: 'pt-BR' } }
  const savedPromise = new Promise(resolve => saved = resolve)
  const chrome = {
    action: { onClicked: { addListener: () => {} }, setBadgeText: async () => {}, setBadgeBackgroundColor: async () => {} },
    runtime: { onInstalled: { addListener: fn => installed = fn }, onStartup: { addListener: () => {} } },
    contextMenus: { removeAll: async () => {}, create: menu => menus.push(menu), onClicked: { addListener: fn => clicked = fn } },
    storage: { onChanged: { addListener: () => {} }, local: { get: async defaults => ({ ...defaults, ...data }), set: async next => { Object.assign(data, next); saved() } } },
    tabs: { remove: () => { throw Error('Must not close tabs') } },
  }
  vm.runInNewContext(fs.readFileSync(`dist/chrome/${manifest.background.service_worker}`, 'utf8'), { chrome, URL, console, navigator: { language: 'pt-BR' }, setTimeout: fn => { fn() } })
  await installed()
  assert.equal(menus.length, 2)
  assert.match(menus[0].title, /Salvar/)
  clicked({ menuItemId: 'tabsaver-page', pageUrl: 'https://example.com' }, { title: 'Example', url: 'https://example.com' })
  await savedPromise
  assert.equal(data.collections[0].name, 'Salvos rápidos')
  assert.equal(data.collections[0].tabs[0].url, 'https://example.com/')
})
