const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { createSSRApp, h } = require('vue')
const { renderToString } = require('@vue/server-renderer')
const icons = require('@lucide/vue')

test('all icons imported by the interface render accessible decorative SVGs', async () => {
  const names = new Set()
  for (const file of fs.readdirSync('src').filter(file => file.endsWith('.vue'))) {
    const source = fs.readFileSync(`src/${file}`, 'utf8')
    for (const match of source.matchAll(/^import\s+\{([^}]+)\}\s+from\s+['"]@lucide\/vue['"]/gm)) {
      for (const name of match[1].split(',').map(name => name.trim())) names.add(name)
    }
  }
  assert.ok(names.size > 0)
  for (const name of names) assert.ok(icons[name], `Missing icon: ${name}`)
  const html = await renderToString(createSSRApp({render: () => h('div', [...names].map(name => h(icons[name], {size:16})))}))
  assert.equal((html.match(/<svg\b/g) || []).length, names.size)
  assert.equal((html.match(/aria-hidden="true"/g) || []).length, names.size)
})
