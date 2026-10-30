const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const { validateRelease } = require('./validate-release.cjs')

function nextVersion(current, change) {
  validateRelease(`v${current}`, current, current, current)
  const parts = current.split('.').map(Number)
  const index = ['major', 'minor', 'patch'].indexOf(change)
  let next = change
  if (index >= 0) {
    parts[index]++
    for (let i = index + 1; i < parts.length; i++) parts[i] = 0
    next = parts.join('.')
  }
  validateRelease(`v${next}`, next, next, next)
  const target = next.split('.').map(Number), previous = current.split('.').map(Number)
  const difference = target.findIndex((value, i) => value !== previous[i])
  assert.ok(difference >= 0 && target[difference] > previous[difference], 'A nova versão deve ser maior que a atual.')
  return next
}

function bumpVersion(root, change, write = fs.writeFileSync) {
  const files = ['package.json', 'package-lock.json', 'manifest.json'].map(name => {
    const filename = path.join(root, name), before = fs.readFileSync(filename, 'utf8')
    return { filename, before, data: JSON.parse(before) }
  })
  const [pkg, lock, manifest] = files.map(file => file.data)
  validateRelease(`v${pkg.version}`, pkg.version, manifest.version, lock.version)
  assert.equal(lock.packages?.['']?.version, pkg.version, 'A versão raiz do lockfile deve coincidir antes de incrementar.')
  const next = nextVersion(pkg.version, change)
  for (const file of files) file.data.version = next
  lock.packages[''].version = next
  try {
    for (const file of files) write(file.filename, JSON.stringify(file.data, null, 2) + '\n')
  } catch (error) {
    const failures = [error]
    for (const file of files) {
      try { write(file.filename, file.before) } catch (rollbackError) { failures.push(rollbackError) }
    }
    if (failures.length > 1) throw new AggregateError(failures, 'Falha ao atualizar e recuperar arquivos. Confira as versões antes de continuar.')
    throw error
  }
  return next
}

if (require.main === module) {
  try {
    const change = process.argv[2]
    assert.ok(change && process.argv.length === 3, 'Use npm run version:bump -- patch|minor|major|X.Y.Z')
    const version = bumpVersion(path.resolve(__dirname, '..'), change)
    console.log(`Versão ${version} aplicada ao package.json, package-lock.json e manifest.json. Revise e faça o commit em develop.`)
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}

module.exports = { nextVersion, bumpVersion }
