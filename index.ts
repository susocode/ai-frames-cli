#!/usr/bin/env node
import { program } from 'commander'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf8'))

program
  .name('ai-frames')
  .description('AI context manager for multi-repo workspaces')
  .version(pkg.version)
  .option('-d, --debug', 'enable debug logging')
  .option('--dev', 'run in dev mode (plain HTTP, no browser open)')

program.action(async () => {
  const opts = program.opts()
  const { startServer } = await import('./server.js')
  await startServer({ dev: opts.dev, debug: opts.debug })
})

program.parse()
