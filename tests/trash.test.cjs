const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const modules = {}
function load(name) {
  if (modules[name]) return modules[name]
  const exports = modules[name] = {}
  const code = ts.transpileModule(fs.readFileSync(`src/${name}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  new Function('exports', 'require', code)(exports, path => load(path.replace('./', '')))
  return exports
}
const api = load('trash'), model = load('collections'), backup = load('backup')
const tabs = [{ title: 'One', url: 'https://one.example' }, { title: 'Two', url: 'https://two.example' }]
const original = { name: 'Project', date: '2026-01-01', tabs, favorite: true, custom: 'keep' }

test('trash preserves a complete collection, including unreadable records, on restore', () => {
  const raw = { name: 'Legacy', tabs: 42, custom: 'keep' }
  const entry = api.deletedCollection(model.readCollections([raw])[0], 0)
  assert.deepEqual(model.writeCollections(api.restoreDeleted([], entry)), [raw])
})
test('restored tabs return to their position and preserve collection metadata', () => {
  const source = model.readCollections([original])[0], entry = api.deletedTab(source, 0)
  assert.deepEqual(entry.source.tabs, [])
  const remaining = model.readCollections([{ ...original, tabs: [tabs[1]] }])
  assert.deepEqual(model.writeCollections(api.restoreDeleted(remaining, entry)), [original])
  assert.deepEqual(original.tabs, tabs)
})
test('a missing or ambiguous original collection is recreated without restoring unrelated tabs', () => {
  const entry = api.deletedTab(model.readCollections([original])[0], 0)
  const restored = model.writeCollections(api.restoreDeleted([], entry))
  assert.equal(restored[0].custom, 'keep')
  assert.deepEqual(restored[0].tabs, [tabs[0]])
  const ambiguous = model.readCollections([{ ...original, tabs: [] }, { ...original, tabs: [] }])
  assert.equal(api.restoreDeleted(ambiguous, entry).length, 3)
})
test('last-deleted migration retains original data and does not run twice', () => {
  const migrated = api.migrateLastDeleted([], { entry: original, index: 0 })
  assert.deepEqual(migrated[0].source, original)
  assert.equal(api.migrateLastDeleted(migrated, { entry: original, index: 0 }).length, 1)
  assert.equal(api.migrateLastDeleted(migrated, { entry: { ...original, name: 'Another deletion' }, index: 0 }).length, 2)
})
test('malformed trash is rejected instead of being silently discarded', () => {
  const entry = api.deletedCollection(model.readCollections([original])[0], 0)
  for (const value of [{}, [null], [{ ...entry, kind: ['collection'] }], [entry, entry], [{ ...entry, position: -1 }]]) assert.throws(() => api.readTrash(value))
})
test('backup round trip includes trash and remains compatible with old files', () => {
  const trash = [api.deletedCollection(model.readCollections([original])[0], 0)]
  const data = { collections: [], preferences: { language: 'auto', theme: 'system' }, trash }
  assert.deepEqual(backup.parseBackup(JSON.stringify(backup.createBackup(data))).trash, trash)
  const old = { ...data }; delete old.trash
  assert.equal(backup.parseBackup(JSON.stringify(backup.createBackup(old))).trash, undefined)
  assert.equal(api.mergeTrash(trash, trash).length, 1)
  assert.equal(api.mergeTrash(trash, [{ ...trash[0], position: 2 }]).length, 2)
})
test('moving a collection to trash uses one atomic Chrome storage write', async () => {
  const storage = load('collection-storage')
  let payload, calls = 0
  global.chrome = { storage: { local: { get: async defaults => ({...defaults, collections:[original]}), set: async next => { calls++; payload = next } } } }
  const trash = [api.deletedCollection(model.readCollections([original])[0], 0)]
  await storage.writeCollectionData([], { trash })
  assert.equal(calls, 1)
  assert.deepEqual(payload.collections, [])
  assert.deepEqual(payload.trash, trash)
  assert.deepEqual(payload.localRecoveries[0].collections, [original])
  chrome.storage.local.set = async () => { throw new Error('quota') }
  await assert.rejects(storage.writeCollectionData([], { trash }))
  delete global.chrome
})
