import fs from 'fs'
import path from 'path'
import os from 'os'
import { randomUUID } from 'crypto'
import { parse, stringify } from 'yaml'
import { saveToken, getToken, deleteToken } from './keychain.js'

const CONFIG_DIR = path.join(os.homedir(), '.ai-frames')
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.yaml')
const CONTEXTS_DIR = path.join(CONFIG_DIR, 'contexts')

export interface ContextAuth {
  type: 'pat' | 'ssh' | 'none'
  token?: string
  key_path?: string
}

export interface Context {
  id: string        // UUID — directory name on disk
  name: string      // display name as the user typed it
  provider: 'github' | 'gitlab' | 'bitbucket'
  resources_repo: string
  auth: ContextAuth
  workspace: string
}

export interface GlobalConfig {
  active_context: string
  contexts: { id: string; name: string }[]
}

// Path helpers
function contextDir(id: string): string {
  return path.join(CONTEXTS_DIR, id)
}

function contextFile(id: string): string {
  return path.join(contextDir(id), 'context.yaml')
}

export function configExists(): boolean {
  return fs.existsSync(CONFIG_FILE)
}

export function loadGlobalConfig(): GlobalConfig {
  const raw = fs.readFileSync(CONFIG_FILE, 'utf8')
  return parse(raw) as GlobalConfig
}

export function saveGlobalConfig(config: GlobalConfig): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true })
  fs.writeFileSync(CONFIG_FILE, stringify(config), 'utf8')
}

export function loadContext(id: string): Context {
  const raw = fs.readFileSync(contextFile(id), 'utf8')
  const ctx = parse(raw) as Context
  ctx.workspace = ctx.workspace.replace(/^~/, os.homedir())
  return ctx
}

export async function loadContextWithToken(id: string): Promise<Context> {
  const ctx = loadContext(id)
  const token = await getToken(id)
  if (token) ctx.auth = { ...ctx.auth, token }
  return ctx
}

export async function saveContext(context: Context): Promise<void> {
  const dir = contextDir(context.id)
  fs.mkdirSync(dir, { recursive: true })

  // Strip token before writing to disk
  const token = context.auth?.token
  const safe: Context = { ...context, auth: { ...context.auth, token: undefined } }
  fs.writeFileSync(contextFile(context.id), stringify(safe), 'utf8')

  // Store token in system keychain
  if (token) {
    await saveToken(context.id, token)
  } else {
    await deleteToken(context.id).catch(() => {})
  }
}

export function listContexts(): Context[] {
  if (!configExists()) return []
  const global = loadGlobalConfig()
  return global.contexts
    .map(c => {
      try { return loadContext(c.id) } catch { return null }
    })
    .filter((c): c is Context => c !== null)
}

export function getActiveContext(): Context | null {
  if (!configExists()) return null
  const global = loadGlobalConfig()
  if (!global.active_context) return null
  try { return loadContext(global.active_context) } catch { return null }
}

export function setActiveContext(id: string): void {
  const global = loadGlobalConfig()
  global.active_context = id
  saveGlobalConfig(global)
}

export async function addContext(context: Omit<Context, 'id'>): Promise<Context> {
  const id = randomUUID()
  const full: Context = { ...context, id }

  await saveContext(full)

  let global: GlobalConfig
  if (configExists()) {
    global = loadGlobalConfig()
    global.contexts.push({ id, name: full.name })
  } else {
    global = {
      active_context: id,
      contexts: [{ id, name: full.name }],
    }
  }
  if (!global.active_context) global.active_context = id
  saveGlobalConfig(global)

  return full
}

export async function updateContext(id: string, patch: Partial<Omit<Context, 'id'>>): Promise<Context> {
  const existing = loadContext(id)
  const updated = { ...existing, ...patch, id }
  await saveContext(updated)
  if (patch.name) {
    const global = loadGlobalConfig()
    const entry = global.contexts.find(c => c.id === id)
    if (entry) {
      entry.name = patch.name
      saveGlobalConfig(global)
    }
  }
  return updated
}

export function repairConfig(): void {
  if (!configExists()) return
  // Migrate old <uuid>.yaml files to <uuid>/context.yaml
  if (!fs.existsSync(CONTEXTS_DIR)) return
  for (const entry of fs.readdirSync(CONTEXTS_DIR)) {
    if (entry.endsWith('.yaml')) {
      const oldFile = path.join(CONTEXTS_DIR, entry)
      const id = entry.replace('.yaml', '')
      const newDir = contextDir(id)
      const newFile = contextFile(id)
      if (!fs.existsSync(newDir)) {
        fs.mkdirSync(newDir, { recursive: true })
        fs.renameSync(oldFile, newFile)
      }
    }
  }
  // Remove stale config field
  const global = loadGlobalConfig()
  const cleaned = global.contexts.map(({ id, name }) => ({ id, name }))
  global.contexts = cleaned
  saveGlobalConfig(global)
}
