import pkg from '../../package.json'

export function readPackageJson(): { version: string; name: string } {
  return { version: pkg.version, name: pkg.name }
}
