const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const output = ts.transpileModule(fs.readFileSync('src/collections.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const api = {}
new Function('exports', output)(api)
const { readCollections, writeCollections } = api
const tab = { title: 'Example', url: 'https://example.com' }

test('reads array, object, single-tab and JSON legacy formats without map errors', () => {
  for (const tabs of [[tab], { 10: tab }, tab, JSON.stringify([tab]), JSON.stringify({ 10: tab })]) {
    const data = [{ name: 'Legacy', date: '2025-01-01', tabs }]
    const parsed = readCollections(data)
    assert.deepEqual(parsed[0].tabs, [tab])
    assert.equal(parsed[0].unreadableTabs, false)
    assert.doesNotThrow(() => parsed[0].tabs.map(t => t.title))
    assert.deepEqual(writeCollections(parsed), data)
  }
})
test('preserves unreadable records and unknown fields when other collections are saved', () => {
  const data = [null, { name: 'Legacy', tabs: 42, custom: 'keep' }, { name: 'Partial', tabs: [null, tab, false] }]
  const parsed = readCollections(data)
  assert.equal(parsed.every(c => c.unreadableTabs), true)
  assert.deepEqual(parsed[2].tabs, [tab])
  const saved = writeCollections([...parsed, { name: 'New', date: '2026-10-29', tabs: [] }])
  assert.deepEqual(saved.slice(0, 3), data)
})
test('rename changes only the selected name and preserves original legacy tabs', () => {
  const original = { name: 'Legacy', date: '2025-01-01', tabs: { tab }, custom: { keep: true } }
  const parsed = readCollections([original, { ...original }])
  assert.notEqual(parsed[0].key, parsed[1].key)
  parsed[0] = { ...parsed[0], name: 'Renamed', renamed: true }
  assert.deepEqual(writeCollections(parsed), [{ ...original, name: 'Renamed' }, original])
})
test('rejects malformed containers instead of treating them as an empty writable store', () => {
  for (const value of [null, {}, 'corrupt', 42]) assert.throws(() => readCollections(value))
})

test('appending tabs preserves original metadata and existing tabs', () => {
  const original = { name: 'Project', tabs: { old: tab }, date: '2025-01-01', extra: 'keep' }
  const collection = readCollections([original])[0]
  const updated = api.appendTabs(collection, [{ id: 42, title: 'New', url: 'https://new.example' }])
  assert.deepEqual(writeCollections([updated]), [{ ...original, tabs: [tab, { title: 'New', url: 'https://new.example' }] }])
  assert.deepEqual(original.tabs, { old: tab })
  assert.throws(() => api.appendTabs(readCollections([{ tabs: 42 }])[0], [tab]))
})

test('moving tabs is atomic and retains legacy metadata on both collections', () => {
  const data = [{ name: 'A', tabs: [tab], custom: 1 }, { name: 'B', tabs: [], custom: 2 }]
  const parsed = readCollections(data)
  const result = writeCollections(api.moveSavedTab(parsed, 'stored-0', 'stored-1', 0))
  assert.deepEqual(result, [{ ...data[0], tabs: [] }, { ...data[1], tabs: [tab] }])
  assert.throws(() => api.moveSavedTab(parsed, 'stored-0', 'missing', 0))
  assert.deepEqual(data[0].tabs, [tab])
  assert.throws(() => api.manualTab('Unsafe', 'javascript:alert(1)'))
  assert.equal(api.manualTab('', 'https://example.com').title, 'example.com')
})

test('favorite and tags updates preserve unreadable legacy tabs and metadata', () => {
  const data = { name: 'Old', tabs: 42, custom: true }
  const parsed = readCollections([data])[0]
  const result = writeCollections([{ ...parsed, favorite: true, tags: api.parseTags('work, Work, research, '), metadataChanged: true }])[0]
  assert.deepEqual(result, { ...data, favorite: true, tags: ['work', 'research'] })
})

test('duplicates compare normalized URLs while preserving query and fragment differences', () => {
  const tabs = [{ title: 'A', url: 'https://EXAMPLE.com' }, { title: 'B', url: 'https://example.com/' }, { title: 'C', url: 'https://example.com/#section' }, { title: 'D', url: 'https://example.com/?q=test' }]
  assert.equal(api.uniqueTabs(tabs).length, 3)
  assert.equal(api.uniqueTabs(tabs, [tab]).length, 2)
  assert.equal(tabs.length, 4)
})

test('context menu quick saves preserve all collections and skip duplicate links', () => {
  const original = [{ name: 'Other', tabs: 42 }]
  const first = api.quickSave(original, tab, 'Quick saves')
  const second = api.quickSave(first, tab, 'Quick saves')
  assert.equal(second.length, 2)
  assert.deepEqual(second[0], original[0])
  assert.equal(second[1].tabs.length, 1)
  assert.equal(second[1].quickSave, true)
  assert.throws(() => api.quickSave([{ quickSave: true, tabs: 42 }], tab, 'Quick saves'))
})

test('destination options sort by descending creation date without mutating the source', () => {
  const collections = [{ name: 'Old', date: '2020-01-01' }, { name: 'Unknown', date: '' }, { name: 'New', date: '2026-01-01' }]
  assert.deepEqual(api.recentCollections(collections).map(c => c.name), ['New', 'Old', 'Unknown'])
  assert.equal(collections[0].name, 'Old')
})

test('pin metadata survives legacy edits and moves pinned collections first without mutation', () => {
  const data = [{name:'Old', date:'2025', tabs:{tab}, custom:42}, {name:'Pinned', tabs:[], pinned:true}]
  const parsed = readCollections(data)
  assert.equal(api.pinFirst(parsed)[0].name, 'Pinned')
  assert.equal(parsed[0].name, 'Old')
  const stored = writeCollections([{...parsed[0], pinned:true, metadataChanged:true}])[0]
  assert.equal(stored.pinned, true)
  assert.deepEqual(stored.tabs, {tab})
  assert.equal(stored.custom, 42)
})

test('notes round-trip, can be cleared, and preserve legacy raw tabs', () => {
  const original = {name:'Notes', tabs:{tab}, notes:'Retomar\nDocumentação', pinned:true}
  const collection = readCollections([original])[0]
  assert.equal(collection.notes, original.notes)
  assert.deepEqual(writeCollections([collection]), [original])
  const changed = writeCollections([{...collection, notes:'', metadataChanged:true}])[0]
  assert.equal(changed.notes, '')
  assert.deepEqual(changed.tabs, {tab})
  assert.equal(changed.pinned, true)
})

test('global search matches multiple terms across all collection tabs without modifying data', () => {
  const collections = readCollections([{name:'Trabalho', notes:'Retomar autenticação', tags:['projeto'], tabs:[{title:'API Reference',url:'https://docs.example/auth'}]}, {name:'Other',tabs:[tab]}])
  const result = api.searchSavedTabs(collections, ' API  auth ')
  assert.equal(result.length, 1)
  assert.equal(result[0].index, 0)
  assert.equal(result[0].collection.name, 'Trabalho')
  assert.equal(api.searchSavedTabs(collections, 'projeto').length, 1)
  assert.equal(api.searchSavedTabs(collections, 'example').length, 2)
  assert.equal(api.searchSavedTabs(collections, '   ').length, 0)
  assert.equal(collections[0].tabs.length, 1)
})
