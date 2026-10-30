const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const root = path.resolve('dist/chromium')

test('production entry points, icons and HTML dependencies are packaged together', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'))
  const entry = manifest.chrome_url_overrides.newtab
  const resources = [entry,manifest.background.service_worker,...Object.values(manifest.icons),...Object.values(manifest.action.default_icon)]
  const html = fs.readFileSync(path.join(root,entry),'utf8')
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const url = match[1]
    assert.ok(!/^(https?:)?\/\//.test(url), `Unexpected external resource: ${url}`)
    resources.push(url.startsWith('/') ? url.slice(1) : path.join(path.dirname(entry),url))
  }
  for (const file of resources) assert.ok(fs.statSync(path.join(root,file)).isFile(), `Missing build resource: ${file}`)
})
test('release build contains the current license and privacy policy', () => {
  for (const file of ['LICENSE','PRIVACY.md']) assert.deepEqual(fs.readFileSync(path.join(root,file)),fs.readFileSync(file))
})
