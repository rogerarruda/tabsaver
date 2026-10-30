const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
function load(name) { const api = {}; new Function('exports', ts.transpileModule(fs.readFileSync(`src/${name}.ts`, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(api); return api }
const api = load('browser-tabs')
const group = {key:'session:7', title:'Projeto', color:'green', collapsed:true}
test('captures group metadata once per group and uses distinct identities for different saves', async () => {
  let calls = 0
  const tabs = [{id:1, url:'https://a.example', groupId:7}, {id:2, url:'https://b.example', groupId:7}, {id:3, url:'https://c.example', groupId:-1}]
  const get = async id => {calls++; return {...group, id}}
  const result = await api.captureTabs(tabs, get)
  assert.equal(calls, 1)
  assert.deepEqual(result[0].group, result[1].group)
  assert.equal(result[2].group, undefined)
  const next = await api.captureTabs(tabs, get)
  assert.notEqual(result[0].group.key, next[0].group.key)
  assert.equal(result[0].group.title, 'Projeto')
})
test('restores only newly opened pages to recreated groups and preserves title/color/collapse', async () => {
  const grouped = [], updated = [], created = []
  const opener = api.createBrowserOpener({tabs:{create:async options => {created.push(options); return {id:created.length}}, group:async options => {grouped.push(options); return 100}}, tabGroups:{update:async (...args) => updated.push(args)}}, 12)
  await opener.open({url:'https://a.example', group})
  await opener.open({url:'https://b.example', group})
  await opener.open({url:'https://c.example'})
  assert.deepEqual(grouped, [{tabIds:1}, {tabIds:2, groupId:100}])
  assert.deepEqual(updated, [[100, {title:'Projeto', color:'green', collapsed:true}]])
  assert.equal(created.every(tab => tab.active === false && tab.windowId === 12), true)
  assert.equal(opener.groupFailures, 0)
})
test('a grouping failure does not reopen a page that was already created', async () => {
  let created = 0
  const opener = api.createBrowserOpener({tabs:{create:async () => ({id:++created}), group:async () => {throw Error('group')}}, tabGroups:{}})
  assert.equal(await opener.open({url:'https://a.example', group}), true)
  assert.equal(created, 1)
  assert.equal(opener.groupFailures, 1)
})
test('group metadata survives normalization and moves, while runtime tab ids are stripped', () => {
  const c = load('collections')
  const parsed = c.readCollections([{name:'A',tabs:[{id:42,title:'A',url:'https://a.example',group}]}, {name:'B',tabs:[]}])
  const next = c.moveSavedTab(parsed, 'stored-0', 'stored-1', 0)
  assert.deepEqual(c.writeCollections(next)[1].tabs, [{title:'A',url:'https://a.example',group}])
})
