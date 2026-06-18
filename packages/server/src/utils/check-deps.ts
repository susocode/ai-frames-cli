import { execSync } from 'child_process'
import os from 'os'
import chalk from 'chalk'

export function checkDependencies(): void {
  if (!isOpensslAvailable()) {
    const platform = os.platform()
    console.error(chalk.red('\n✕ ai-frames requires openssl to enable HTTPS.\n'))
    console.error(chalk.yellow('  Install it with:'))

    if (platform === 'darwin') {
      console.error(chalk.cyan('    brew install openssl'))
    } else if (platform === 'linux') {
      console.error(chalk.cyan('    Ubuntu/Debian:  sudo apt install openssl'))
      console.error(chalk.cyan('    Fedora/RHEL:    sudo dnf install openssl'))
      console.error(chalk.cyan('    Alpine:         sudo apk add openssl'))
    } else if (platform === 'win32') {
      console.error(chalk.cyan('    winget install ShiningLight.OpenSSL'))
      console.error(chalk.cyan('    or download from: https://slproweb.com/products/Win32OpenSSL.html'))
    } else {
      console.error(chalk.cyan('    Install openssl using your system package manager.'))
    }

    console.error(chalk.yellow('\n  Run ai-frames again after installing.\n'))
    process.exit(1)
  }
}

function isOpensslAvailable(): boolean {
  try {
    execSync('openssl version', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}
