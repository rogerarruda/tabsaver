const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const { nextVersion, bumpVersion } = require('../scripts/bump-version.cjs')
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tabsaver-bump-'))
  t.after(() => fs.rmSync(root, {recursive:true, force:true}))
  const data = {
    'package.json':{version:'0.0.2', scripts:{test:'keep'}},
    'package-lock.json':{version:'0.0.2', packages:{'':{version:'0.0.2'}, 'node_modules/example':{version:'8.9.0'}}},
    'manifest.json':{version:'0.0.2', permissions:['tabs','storage']},
  }
  for (const [file, value] of Object.entries(data)) fs.writeFileSync(path.join(root,file), JSON.stringify(value))
  return {root, read:file => JSON.parse(fs.readFileSync(path.join(root,file),'utf8'))}
}
test('version bumps reset lower components and accept an explicit higher stable version', () => {
  assert.equal(nextVersion('0.0.2','patch'), '0.0.3')
  assert.equal(nextVersion('0.0.2','minor'), '0.1.0')
  assert.equal(nextVersion('0.1.4','major'), '1.0.0')
  assert.equal(nextVersion('0.0.2','1.2.3'), '1.2.3')
})
test('version bump rejects downgrade, unchanged, invalid and Chrome-incompatible versions', () => {
  for (const value of ['0.0.1','0.0.2','1.0.0-beta.1','v1.0.0','65536.0.0','01.0.0','nope']) assert.throws(() => nextVersion('0.0.2',value))
  assert.throws(() => nextVersion('0.0.65535','patch'))
})
test('bump updates every project version and preserves dependencies, scripts and permissions', t => {
  const {root,read}=fixture(t)
  assert.equal(bumpVersion(root,'minor'),'0.1.0')
  assert.equal(read('package.json').version,'0.1.0')
  assert.equal(read('manifest.json').version,'0.1.0')
  assert.equal(read('package-lock.json').version,'0.1.0')
  assert.equal(read('package-lock.json').packages[''].version,'0.1.0')
  assert.equal(read('package-lock.json').packages['node_modules/example'].version,'8.9.0')
  assert.deepEqual(read('package.json').scripts,{test:'keep'})
  assert.deepEqual(read('manifest.json').permissions,['tabs','storage'])
})
test('inconsistent input is rejected without changing any version', t => {
  const {root,read}=fixture(t)
  fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify({version:'0.0.1'}))
  assert.throws(() => bumpVersion(root,'patch'))
  assert.equal(read('package.json').version,'0.0.2')
  assert.equal(read('package-lock.json').version,'0.0.2')
})
test('a failed write rolls back the versions already written', t => {
  const {root,read}=fixture(t)
  let writes=0
  assert.throws(() => bumpVersion(root,'patch',(file,value) => {if (++writes===2) throw Error('write failed');fs.writeFileSync(file,value)}))
  for(const file of ['package.json','package-lock.json','manifest.json']) assert.equal(read(file).version,'0.0.2')
})
