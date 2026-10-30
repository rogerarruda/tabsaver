const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const modules = {}
function load(name) {
  if (modules[name]) return modules[name]
  const exports = modules[name] = {}
  const compiled = ts.transpileModule(fs.readFileSync(`src/${name}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  new Function('exports', 'require', compiled)(exports, path => load(path.replace('./', '')))
  return exports
}
const api = load('backup')
const prefs = { language: 'pt-BR', theme: 'system' }
const legacy = { name: 'Old', date: '2025-01-01', tabs: { a: { url: 'https://example.com', title: 'Example' } }, extra: 'keep' }
const snapshot = { collections: [legacy, { name: 'Unreadable', tabs: 42 }], preferences: prefs }

test('backup round trip preserves legacy data, unknown fields and preferences', () => {
  const file = api.createBackup(snapshot)
  const restored = api.parseBackup(JSON.stringify(file))
  assert.deepEqual(restored.collections, snapshot.collections)
  assert.deepEqual(restored.preferences, prefs)
  assert.deepEqual(api.summarizeBackup(restored), { collections: 2, tabs: 1, unreadable: true })
})
test('rejects unrelated, damaged and unsupported backups', () => {
  for (const text of ['not json', '[]', '{}', JSON.stringify({ ...api.createBackup(snapshot), version: 2 }), JSON.stringify({ ...api.createBackup(snapshot), collections: {} }), JSON.stringify({ ...api.createBackup(snapshot), preferences: { language: 'xx', theme: 'dark' } }), JSON.stringify({ ...api.createBackup(snapshot), preferences: { language: ['en'], theme: ['dark'] } })]) assert.throws(() => api.parseBackup(text))
})
test('merge preserves existing records and skips identical records regardless of object key order', () => {
  const reordered = { extra: 'keep', tabs: legacy.tabs, date: legacy.date, name: legacy.name }
  const newer = { ...legacy, date: '2026-01-01' }
  assert.deepEqual(api.mergeCollections([legacy], [reordered, newer, newer]), [legacy, newer])
})
test('Chrome restore writes snapshot and recovery together, undo restores original data', async () => {
  let store = { ...snapshot }
  global.chrome = { storage: { local: { get: async defaults => ({...defaults, ...store}), set: async values => { store = { ...store, ...values } } } } }
  const restored = { collections: [], preferences: { language: 'en', theme: 'dark' } }
  await api.writeBackupStorage(restored, snapshot)
  assert.deepEqual((await api.readBackupStorage()).collections, [])
  assert.deepEqual(store.backupRecovery, snapshot)
  await api.writeBackupStorage(store.backupRecovery, null)
  assert.deepEqual(store.collections, snapshot.collections)
  assert.equal(store.backupRecovery, null)
  const before = store
  chrome.storage.local.set = async () => { throw new Error('quota') }
  await assert.rejects(api.writeBackupStorage(restored, snapshot))
  assert.deepEqual(store, before)
  delete global.chrome
})
test('preview rolls back writes when local storage fails halfway through', async () => {
  const values = new Map([['tabsaver-preview', JSON.stringify(snapshot.collections)], ['tabsaver-preferences', JSON.stringify(prefs)]])
  let failOnce = true
  global.localStorage = { getItem: k => values.get(k) ?? null, removeItem: k => values.delete(k), setItem: (k,v) => { if (k === 'tabsaver-preferences' && failOnce) { failOnce = false; throw new Error('quota') }; values.set(k,v) } }
  await assert.rejects(api.writeBackupStorage({ collections: [], preferences: prefs }, snapshot))
  assert.deepEqual(JSON.parse(values.get('tabsaver-preview')), snapshot.collections)
  assert.equal(values.has('tabsaver-recovery'), false)
  delete global.localStorage
})

test('backup fingerprints ignore object key order and detect actual changes', async () => {
  const a = await api.backupFingerprint(snapshot)
  const b = await api.backupFingerprint({ preferences: prefs, collections: snapshot.collections })
  assert.equal(a, b)
  assert.equal(a.length, 64)
  assert.notEqual(a, await api.backupFingerprint({ ...snapshot, collections: [] }))
})
