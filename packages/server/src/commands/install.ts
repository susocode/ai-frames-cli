import chalk from 'chalk'
import { configExists, getActiveContext } from '../services/config.js'
import { install } from '../services/installer.js'

export async function runInstall(): Promise<void> {
  if (!configExists()) {
    console.error(chalk.red('No ai-frames config found. Run `ai-frames` to set up.'))
    process.exit(1)
  }
  const context = getActiveContext()
  if (!context) {
    console.error(chalk.red('No active context. Run `ai-frames` to configure one.'))
    process.exit(1)
  }
  console.log(chalk.cyan(`Installing context: ${context.name}`))
  console.log(chalk.gray(`Workspace: ${context.workspace}`))
  await install(context)
  console.log(chalk.green('Done.'))
}
