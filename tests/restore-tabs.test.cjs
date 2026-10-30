const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const api = {}
new Function('exports', ts.transpileModule(fs.readFileSync('src/restore-tabs.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(api)
const tabs = Array.from({length: 12}, (_, i) => ({ title: String(i), url: `https://${i}.example` }))
test('opens sequential batches, pauses after five and continues after a page fails', async () => {
  const events = []
  const result = await api.restoreTabs(tabs, { open: async tab => { events.push(tab.title); if (tab.title === '2') throw Error('page'); return true }, cancelled: () => false, progress: () => {}, pause: async () => events.push('pause') })
  assert.deepEqual(events, ['0','1','2','3','4','pause','5','6','7','8','9','pause','10','11'])
  assert.deepEqual(result, {opened:11, attempted:12, cancelled:false})
})
test('cancelling during a pause prevents subsequent tabs from opening', async () => {
  let cancelled = false, calls = 0
  const result = await api.restoreTabs(tabs, { open: async () => {calls++; return true}, cancelled: () => cancelled, progress: () => {}, pause: async () => {cancelled = true} })
  assert.equal(calls, 5)
  assert.deepEqual(result, {opened:5, attempted:5, cancelled:true})
})
