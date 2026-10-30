const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const destination = path.join(root, 'dist', 'chromium')
fs.accessSync(path.join(destination, 'manifest.json'))
for (const filename of ['LICENSE', 'PRIVACY.md']) {
  fs.copyFileSync(path.join(root, filename), path.join(destination, filename))
}
console.log('Licença e política de privacidade incluídas no build do Chrome.')
