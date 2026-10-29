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
    runtime: { getManifest: () => manifest, getURL: () => 'chrome-extension://test-id/' },
    tabs: { create: async options => created.push(options) },
  }
  const code = fs.readFileSync(`dist/chrome/${manifest.background.service_worker}`, 'utf8')
  vm.runInNewContext(code, { chrome, URL, console })
  await listener()
  assert.equal(created.length, 1)
  assert.equal(created[0].url, `chrome-extension://test-id/${manifest.chrome_url_overrides.newtab}`)
  assert.equal(created[0].url.includes('chrome://newtab'), false)
})
