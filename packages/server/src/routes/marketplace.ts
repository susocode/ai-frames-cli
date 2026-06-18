import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { parse as parseYaml } from 'yaml'
import { loadContextWithToken, loadGlobalConfig, configExists } from '../services/config.js'
import { loadSelections, saveSelections, ResourceType } from '../services/selections.js'
import { repoDir } from '../services/sync.js'
import { catchError, errorResponse } from '../utils/errors.js'
import { logger } from '../utils/logger.js'

export const marketplaceRouter = Router()

const CONTEXTS_DIR = path.join(os.homedir(), '.ai-frames', 'contexts')

async function getContext() {
  if (!configExists()) return null
  const global = loadGlobalConfig()
  return loadContextWithToken(global.active_context)
}

interface ItemMeta {
  file: string
  title: string
  description: string
  version: string
  scope: string
  resources?: Partial<Record<ResourceType, string[]>>
}

function parseFrontmatter(content: string): { title?: string; description?: string; version?: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return {}
  const meta: Record<string, string> = {}
  for (const line of match[1].split('\n')) {
    const [key, ...rest] = line.split(':')
    if (key && rest.length) meta[key.trim()] = rest.join(':').trim()
  }
  return meta
}


function listRepoItems(contextId: string, type: ResourceType): ItemMeta[] {
  const dir = path.join(repoDir(contextId), '.aicontext', type)
  if (!fs.existsSync(dir)) return []

  const items: ItemMeta[] = []

  function readDir(currentDir: string, scope: string) {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      if (entry.name === '.gitkeep') continue
      const full = path.join(currentDir, entry.name)
      if (entry.isDirectory()) {
        // Subdirs like .claude, .copilot are assistant scopes
        const subScope = entry.name.startsWith('.') ? entry.name : scope
        readDir(full, subScope)
      } else {
        const relativePath = path.relative(dir, full).replace(/\\/g, '/')
        const content = fs.readFileSync(full, 'utf8')
        const meta = parseFrontmatter(content)
        const item: ItemMeta = {
          file: relativePath,
          title: meta.title ?? entry.name.replace(/\.(md|yaml|json|mdc)$/, ''),
          description: meta.description ?? 'n/a',
          version: meta.version ?? 'n/a',
          scope,
        }
        // For templates: parse the body as YAML to extract resource lists
        if (type === 'templates') {
          const body = content.replace(/^---\n[\s\S]*?\n---\n?/, '')
          try {
            item.resources = parseYaml(body) as Partial<Record<ResourceType, string[]>>
          } catch { /* ignore parse errors */ }
        }
        items.push(item)
      }
    }
  }

  readDir(dir, 'shared')
  return items.sort((a, b) => a.title.localeCompare(b.title))
}

// GET /api/marketplace/:type/file?path=... — read file content from repo clone
marketplaceRouter.get('/:type/file', async (req, res) => {
  const type = req.params.type as ResourceType
  const filePath = req.query.path as string
  const context = await getContext()
  if (!context) { errorResponse(res, 'context-not-found', 404); return }
  if (!filePath) { errorResponse(res, 'invalid-input'); return }
  try {
    const full = path.join(repoDir(context.id), '.aicontext', type, filePath)
    if (!fs.existsSync(full)) { errorResponse(res, 'repo-not-found', 404); return }
    const content = fs.readFileSync(full, 'utf8')
    const isYaml = filePath.endsWith('.yaml') || filePath.endsWith('.yml')
    const body = content.replace(/^---\n[\s\S]*?\n---\n?/, '').trim()
    res.json({ content: body, raw: content, isYaml })
  } catch (err) {
    catchError(res, err)
  }
})

// GET /api/marketplace/:type — list available items + which are selected
marketplaceRouter.get('/:type', async (req, res) => {
  const type = req.params.type as ResourceType
  const context = await getContext()
  if (!context) { errorResponse(res, 'context-not-found', 404); return }

  try {
    const available = listRepoItems(context.id, type)
    const selections = loadSelections(context.id)
    const selected = selections[type] ?? []
    res.json({ type, available, selected: selected.filter(s => available.some(a => a.file === s)) })
  } catch (err) {
    logger.log(`marketplace GET failed: ${err instanceof Error ? err.message : String(err)}`)
    catchError(res, err)
  }
})

// PUT /api/marketplace/templates — install selected templates (fan-out to resource types)
marketplaceRouter.put('/templates', async (req, res) => {
  const { selected } = req.body as { selected: string[] }
  const context = await getContext()
  if (!context) { errorResponse(res, 'context-not-found', 404); return }

  try {
    const available = listRepoItems(context.id, 'templates')
    const selections = loadSelections(context.id)

    // Collect all resource items from newly selected templates
    const merged: Partial<Record<ResourceType, Set<string>>> = {}
    for (const file of selected) {
      const tmpl = available.find(a => a.file === file)
      if (!tmpl?.resources) continue
      for (const [rtype, items] of Object.entries(tmpl.resources)) {
        const t = rtype as ResourceType
        if (!merged[t]) merged[t] = new Set(selections[t] ?? [])
        for (const item of (items ?? [])) merged[t]!.add(item)
      }
    }

    // Save and sync each affected type
    for (const [rtype, itemSet] of Object.entries(merged)) {
      const t = rtype as ResourceType
      selections[t] = Array.from(itemSet)
      await syncTypeToWorkspace(context.id, context.workspace, t, selections[t]!)
      logger.log(`template install: synced ${t} (${selections[t]!.length} items)`)
    }

    selections['templates'] = selected
    saveSelections(context.id, selections)

    res.json({ ok: true, installed: selected })
  } catch (err) {
    logger.log(`marketplace templates PUT failed: ${err instanceof Error ? err.message : String(err)}`)
    catchError(res, err)
  }
})

// PUT /api/marketplace/:type — update selection and sync selected items to workspace
marketplaceRouter.put('/:type', async (req, res) => {
  const type = req.params.type as ResourceType
  const { selected } = req.body as { selected: string[] }
  const context = await getContext()
  if (!context) { errorResponse(res, 'context-not-found', 404); return }

  try {
    const selections = loadSelections(context.id)
    selections[type] = selected
    saveSelections(context.id, selections)

    await syncTypeToWorkspace(context.id, context.workspace, type, selected)

    res.json({ ok: true, selected })
  } catch (err) {
    logger.log(`marketplace PUT failed: ${err instanceof Error ? err.message : String(err)}`)
    catchError(res, err)
  }
})

// Sync selected items of a type from repo clone → workspace
export async function syncTypeToWorkspace(
  contextId: string,
  workspace: string,
  type: ResourceType,
  selected: string[]
): Promise<void> {
  const repoTypeDir = path.join(repoDir(contextId), '.aicontext', type)
  const wsTypeDir = path.join(workspace, '.aicontext', type)

  if (!fs.existsSync(repoTypeDir)) {
    logger.log(`marketplace sync: no ${type}/ in repo`)
    return
  }

  fs.mkdirSync(wsTypeDir, { recursive: true })

  // Remove items from workspace that are no longer selected
  if (fs.existsSync(wsTypeDir)) {
    for (const entry of fs.readdirSync(wsTypeDir)) {
      if (entry.startsWith('.')) continue // keep .claude, .copilot subdirs
      if (!selected.includes(entry)) {
        const full = path.join(wsTypeDir, entry)
        fs.rmSync(full, { recursive: true, force: true })
        logger.log(`marketplace sync: removed ${type}/${entry}`)
      }
    }
  }

  // Copy selected items from repo to workspace
  for (const item of selected) {
    const src = path.join(repoTypeDir, item)
    const dest = path.join(wsTypeDir, item)
    if (!fs.existsSync(src)) {
      logger.log(`marketplace sync: ${type}/${item} not in repo, skipping`)
      continue
    }
    const stat = fs.statSync(src)
    if (stat.isDirectory()) {
      copyDir(src, dest)
    } else {
      fs.copyFileSync(src, dest)
    }
    logger.log(`marketplace sync: copied ${type}/${item}`)
  }
}

// Sync ALL selected types to workspace (called after git pull)
export async function syncAllSelectionsToWorkspace(contextId: string, workspace: string): Promise<void> {
  const selections = loadSelections(contextId)
  for (const [type, selected] of Object.entries(selections)) {
    if (selected && selected.length > 0) {
      await syncTypeToWorkspace(contextId, workspace, type as ResourceType, selected)
    }
  }
}

function copyDir(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name)
    const d = path.join(dest, entry.name)
    entry.isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d)
  }
}
