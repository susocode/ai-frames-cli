import fs from 'fs'
import path from 'path'
import { parse as parseYaml } from 'yaml'
import { loadSelections, saveSelections, ResourceType } from './selections'
import { repoDir } from './sync'
import { logger } from '../utils/logger'

export interface ItemMeta {
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

export function listRepoItems(contextId: string, type: ResourceType): ItemMeta[] {
  const dir = path.join(repoDir(contextId), '.aicontext', type)
  if (!fs.existsSync(dir)) return []

  const items: ItemMeta[] = []

  function readDir(currentDir: string, scope: string) {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      if (entry.name === '.gitkeep') continue
      const full = path.join(currentDir, entry.name)
      if (entry.isDirectory()) {
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
        if (type === 'templates') {
          const body = content.replace(/^---\n[\s\S]*?\n---\n?/, '')
          try { item.resources = parseYaml(body) as Partial<Record<ResourceType, string[]>> } catch { /* ignore */ }
        }
        items.push(item)
      }
    }
  }

  readDir(dir, 'shared')
  return items.sort((a, b) => a.title.localeCompare(b.title))
}

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

  if (fs.existsSync(wsTypeDir)) {
    for (const entry of fs.readdirSync(wsTypeDir)) {
      if (entry.startsWith('.')) continue
      if (!selected.includes(entry)) {
        fs.rmSync(path.join(wsTypeDir, entry), { recursive: true, force: true })
        logger.log(`marketplace sync: removed ${type}/${entry}`)
      }
    }
  }

  for (const item of selected) {
    const src = path.join(repoTypeDir, item)
    const dest = path.join(wsTypeDir, item)
    if (!fs.existsSync(src)) { logger.log(`marketplace sync: ${type}/${item} not in repo, skipping`); continue }
    const stat = fs.statSync(src)
    if (stat.isDirectory()) { copyDir(src, dest) } else { fs.copyFileSync(src, dest) }
    logger.log(`marketplace sync: copied ${type}/${item}`)
  }
}

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
