import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

export function readPackageJson(): { version: string; name: string } {
  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const pkgPath = path.resolve(__dirname, '../../package.json')
  return JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
}
