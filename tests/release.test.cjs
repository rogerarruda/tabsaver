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
