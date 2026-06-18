import { program } from 'commander'
import { startServer } from './server.js'
import { runInstall } from './commands/install.js'
import { readPackageJson } from './utils/fs.js'
import { logger } from './utils/logger.js'

const pkg = readPackageJson()

program
  .name('ai-frames')
  .description('AI context manager for multi-repo workspaces')
  .version(pkg.version)
  .option('-d, --debug', 'enable debug logging')

program
  .command('install', { isDefault: false })
  .description('Materialize runtimes/, clone repos and create symlinks (no UI)')
  .action(runInstall)

program
  .action(() => {
    const opts = program.opts()
    if (opts.debug) logger.debug = true
    startServer()
  })

program.parse()
