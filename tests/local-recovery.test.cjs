const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const modules = {}
function load(name) { if (modules[name]) return modules[name]; const exports = modules[name] = {}; new Function('exports','require', ts.transpileModule(fs.readFileSync(`src/${name}.ts`, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(exports, path => load(path.replace('./',''))); return exports }
const api = load('local-recovery')
const original = [{name:'Legacy',tabs:42,custom:'keep'}]
test('keeps up to five independent snapshots and avoids duplicate consecutive copies', () => {
  let history = api.captureRecovery([], original, [])
  assert.deepEqual(api.captureRecovery(history, original, []), history)
  original[0].custom = 'changed'
  assert.equal(history[0].collections[0].custom, 'keep')
  for (let i = 0; i < 8; i++) history = api.captureRecovery(history, [{name:String(i), tabs:[]}], [])
  assert.equal(history.length, 5)
  assert.equal(history[0].collections[0].name, '7')
  assert.equal(history[4].collections[0].name, '3')
})
test('capture rejects invalid history or current data instead of overwriting it', () => {
  assert.throws(() => api.captureRecovery({}, [], []))
  assert.throws(() => api.captureRecovery([], null, []))
  assert.throws(() => api.captureRecovery([], [], [null]))
})
test('collection changes and their recovery point are committed in one write; quota failure changes neither', async () => {
  let store = {collections:original, trash:[],localRecoveries:[]}, writes = 0
  global.chrome = {storage:{local:{get:async defaults => ({...defaults,...store}),set:async values => {writes++; store={...store,...values}}}}}
  const storage = load('collection-storage')
  await storage.writeCollectionData([])
  assert.equal(writes, 1)
  assert.deepEqual(store.collections, [])
  assert.deepEqual(store.localRecoveries[0].collections, original)
  const before = store
  chrome.storage.local.set = async () => {throw Error('quota')}
  await assert.rejects(storage.writeCollectionData([{name:'Next',tabs:[]}]))
  assert.deepEqual(store, before)
  delete global.chrome
})
