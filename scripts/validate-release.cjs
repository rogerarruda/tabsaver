const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

function validateRelease(tag, packageVersion, manifestVersion, lockVersion) {
  assert.match(tag || '', /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/, 'Use uma tag estável no formato vX.Y.Z, por exemplo v0.0.2.')
  const version = tag.slice(1)
  assert.equal(packageVersion, version, 'A tag e a versão do package.json devem coincidir.')
  assert.equal(manifestVersion, version, 'A tag e a versão do manifest.json devem coincidir.')
  assert.equal(lockVersion, version, 'Atualize também a versão no package-lock.json.')
  const parts = version.split('.').map(Number)
  assert.ok(parts.every(part => Number.isInteger(part) && part <= 65535) && parts.some(part => part > 0), 'A versão precisa ser válida para o Chrome.')
  return version
}

if (require.main === module) {
  try {
    const read = file => JSON.parse(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'))
    const lock = read('package-lock.json')
    const packageVersion = read('package.json').version
    const version = validateRelease(process.argv[2] || process.env.RELEASE_TAG || `v${packageVersion}`, packageVersion, read('manifest.json').version, lock.version)
    assert.equal(lock.packages[''].version, version, 'A versão raiz do lockfile também deve coincidir.')
    if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `tag=v${version}\n`)
    console.log(`Versão ${version} validada para publicação.`)
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}

module.exports = { validateRelease }
