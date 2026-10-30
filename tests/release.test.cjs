const { test } = require('node:test')
const assert = require('node:assert/strict')
const { validateRelease } = require('../scripts/validate-release.cjs')

test('release accepts a stable tag matching package, Chrome manifest and lockfile', () => {
  assert.equal(validateRelease('v0.0.2', '0.0.2', '0.0.2', '0.0.2'), '0.0.2')
})
test('release rejects missing, malformed, prerelease and Chrome-incompatible tags', () => {
  for (const tag of [undefined, '', '0.0.2', 'v0.0.2-beta.1', 'v01.0.0', 'v0.0.0', 'v65536.0.0', 'v1.2.3;echo unexpected']) {
    const version = tag?.slice(1)
    assert.throws(() => validateRelease(tag, version, version, version))
  }
})
test('release rejects stale package, manifest or lockfile versions', () => {
  assert.throws(() => validateRelease('v0.0.3', '0.0.2', '0.0.3', '0.0.3'))
  assert.throws(() => validateRelease('v0.0.3', '0.0.3', '0.0.2', '0.0.3'))
  assert.throws(() => validateRelease('v0.0.3', '0.0.3', '0.0.3', '0.0.2'))
})

test('release command derives the current version and exposes its validated tag to Actions', t => {
  const fs = require('node:fs'), os = require('node:os'), path = require('node:path')
  const { spawnSync } = require('node:child_process')
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tabsaver-version-'))
  t.after(() => fs.rmSync(directory, { recursive:true, force:true }))
  const output = path.join(directory, 'output')
  const env = {...process.env, GITHUB_OUTPUT:output}
  delete env.RELEASE_TAG
  const result = spawnSync(process.execPath, ['scripts/validate-release.cjs'], {env, encoding:'utf8'})
  assert.equal(result.status, 0, result.stderr)
  const version = JSON.parse(fs.readFileSync('package.json', 'utf8')).version
  assert.equal(fs.readFileSync(output, 'utf8'), `tag=v${version}\n`)
})
