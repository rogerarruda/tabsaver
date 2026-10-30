const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const destination = path.join(root, 'dist', 'chromium')
fs.accessSync(path.join(destination, 'manifest.json'))
for (const filename of ['LICENSE', 'PRIVACY.md']) {
  fs.copyFileSync(path.join(root, filename), path.join(destination, filename))
}
// Keep existing unpacked installs on the same path so users can reload without reinstalling.
const previousDestination = path.join(root, 'dist', 'chrome')
fs.rmSync(previousDestination, { recursive: true, force: true })
fs.cpSync(destination, previousDestination, { recursive: true })
console.log('Licença e política de privacidade incluídas no build do Chrome.')
console.log('Cópia de compatibilidade atualizada em dist/chrome para instalações existentes.')
