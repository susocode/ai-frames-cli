import fs from 'fs'
import path from 'path'
import os from 'os'
import { simpleGit } from 'simple-git'
import { parse, stringify } from 'yaml'
import { logger } from '../utils/logger.js'
import { Context } from './config.js'

const CONFIG_DIR = path.join(os.homedir(), '.ai-frames')
const CONTEXTS_DIR = path.join(CONFIG_DIR, 'contexts')

export interface LockFile {
  hash: string
  synced_at: string
  remote_hash?: string
}

// Paths
export function contextDir(id: string) {
  return path.join(CONTEXTS_DIR, id)
}

export function repoDir(id: string) {
  return path.join(contextDir(id), 'repo')
}

export function lockFile(id: string) {
  return path.join(contextDir(id), 'lock.yaml')
}

export function readLock(id: string): LockFile | null {
  const f = lockFile(id)
  if (!fs.existsSync(f)) return null
  return parse(fs.readFileSync(f, 'utf8')) as LockFile
}

export function writeLock(id: string, lock: LockFile): void {
  fs.writeFileSync(lockFile(id), stringify(lock), 'utf8')
}

function buildCloneUrl(context: Context): string {
  const { provider, resources_repo, auth } = context
  const hosts: Record<string, string> = {
    github: 'github.com',
    gitlab: 'gitlab.com',
    bitbucket: 'bitbucket.org',
  }
  const host = hosts[provider]

  if (auth?.token) {
    return `https://${auth.token}@${host}/${resources_repo}.git`
  }
  if (auth?.key_path) {
    return `git@${host}:${resources_repo}.git`
  }
  return `https://${host}/${resources_repo}.git`
}

// Clone the resources repo into ~/.ai-frames/contexts/<uuid>/repo/
function makeGit(dir?: string) {
  // Pass only auth-related env vars, avoid any blocked ones
  const baseDir = dir ?? process.cwd()
  return simpleGit({ baseDir })
}

function gitEnv(context: Context): Record<string, string> {
  const env: Record<string, string> = {}
  if (context.auth?.token) {
    // Token is injected in the URL — no extra env needed
  }
  if (context.auth?.key_path) {
    const key = context.auth.key_path.replace(/^~/, os.homedir())
    env['GIT_SSH_COMMAND'] = `ssh -i ${key} -o StrictHostKeyChecking=no -o BatchMode=yes`
  }
  return env
}

export async function cloneResourcesRepo(context: Context): Promise<string> {
  const dest = repoDir(context.id)
  const url = buildCloneUrl(context)

  if (fs.existsSync(dest)) {
    logger.log(`sync: repo already cloned at ${dest}`)
    return dest
  }

  logger.log(`sync: cloning ${context.resources_repo} into ${dest}`)
  const git = makeGit()
  const env = gitEnv(context)
  if (Object.keys(env).length > 0) {
    await git.env(env).clone(url, dest)
  } else {
    await git.clone(url, dest)
  }
  return dest
}

// Get current HEAD hash of the cloned repo
export async function getLocalHash(id: string): Promise<string | null> {
  const dir = repoDir(id)
  if (!fs.existsSync(dir)) return null
  const git = makeGit(dir)
  const log = await git.log({ maxCount: 1 })
  return log.latest?.hash ?? null
}

// Get remote HEAD hash without pulling
export async function getRemoteHash(context: Context): Promise<string | null> {
  const dir = repoDir(context.id)
  if (!fs.existsSync(dir)) return null
  const env = gitEnv(context)
  const g = makeGit(dir)
  const git = Object.keys(env).length > 0 ? g.env(env) : g

  try {
    await git.fetch(['origin'])
    const result = await git.raw(['rev-parse', 'origin/HEAD'])
    return result.trim()
  } catch {
    try {
      const result = await git.raw(['rev-parse', 'origin/main'])
      return result.trim()
    } catch {
      return null
    }
  }
}

// Pull latest changes
export async function pullResourcesRepo(context: Context): Promise<string> {
  const dir = repoDir(context.id)
  const env = gitEnv(context)
  const g = makeGit(dir)
  const git = Object.keys(env).length > 0 ? g.env(env) : g

  logger.log(`sync: pulling ${context.resources_repo}`)
  // Discard any local modifications and untracked files before pulling
  await git.checkout('--', ['.'])
  await git.clean('f', ['-d'])
  await git.pull()
  const log = await git.log({ maxCount: 1 })
  return log.latest?.hash ?? ''
}

// Copy .aicontext/ from cloned repo to workspace
// If enabledDirs provided, only copy subdirs that exist in workspace already
export interface CustomMapping {
  repo_path: string
  local_path: string
}

export async function syncToWorkspace(
  context: Context,
  enabledDirs?: string[],
  customMappings?: CustomMapping[]
): Promise<void> {
  const repoRoot = repoDir(context.id)
  const aicontextSrc = path.join(repoRoot, '.aicontext')

  if (!fs.existsSync(aicontextSrc)) {
    if (enabledDirs && enabledDirs.length > 0) {
      for (const subdir of enabledDirs) {
        fs.mkdirSync(path.join(context.workspace, subdir), { recursive: true })
      }
      logger.log(`sync: repo has no .aicontext/, created ${enabledDirs.length} local dirs`)
    }
    return
  }

  // Always ensure base dirs exist in workspace (even if not in enabledDirs list)
  const baseDirs = [
    '.aicontext', '.aicontext/rules', '.aicontext/agents', '.aicontext/skills',
    '.aicontext/prompts', '.aicontext/mcps', '.aicontext/contexts', '.aicontext/templates',
  ]
  for (const dir of baseDirs) {
    fs.mkdirSync(path.join(context.workspace, dir), { recursive: true })
  }

  // Sync standard .aicontext subdirs
  if (enabledDirs && enabledDirs.length > 0) {
    for (const subdir of enabledDirs) {
      const repoSubdir = subdir.replace(/^\.aicontext\/?/, '')
      const srcSubdir = path.join(aicontextSrc, repoSubdir || '.')
      const destSubdir = path.join(context.workspace, subdir)
      if (!fs.existsSync(srcSubdir)) {
        // Dir not in repo — just ensure it exists locally
        fs.mkdirSync(destSubdir, { recursive: true })
        continue
      }
      logger.log(`sync: copying ${subdir}`)
      fs.mkdirSync(destSubdir, { recursive: true })
      copyDir(srcSubdir, destSubdir)
    }
  } else {
    const dest = path.join(context.workspace, '.aicontext')
    logger.log(`sync: copying .aicontext/ → ${dest}`)
    copyDir(aicontextSrc, dest)
  }

  // Sync custom mappings: repo_path → .aicontext/local_path
  if (customMappings && customMappings.length > 0) {
    for (const mapping of customMappings) {
      const srcPath = path.join(repoRoot, mapping.repo_path)
      // local_path may already include .aicontext/ prefix or be an absolute-like path
      const destPath = path.join(context.workspace, mapping.local_path)
      if (!fs.existsSync(srcPath)) {
        logger.log(`sync: custom mapping src not found: ${mapping.repo_path}`)
        continue
      }
      logger.log(`sync: custom mapping ${mapping.repo_path} → .aicontext/${mapping.local_path}`)
      const stat = fs.statSync(srcPath)
      if (stat.isDirectory()) {
        fs.mkdirSync(destPath, { recursive: true })
        copyDir(srcPath, destPath)
      } else {
        fs.mkdirSync(path.dirname(destPath), { recursive: true })
        fs.copyFileSync(srcPath, destPath)
      }
    }
  }
}

function copyDir(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name)
    const d = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      copyDir(s, d)
    } else {
      fs.copyFileSync(s, d)
    }
  }
}
