import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { parse } from 'yaml'
import { getActiveContext } from '@/lib/services/config'
import { loadAssistants } from '@/lib/services/assistants'
import { loadSelections, Selections, ResourceType } from '@/lib/services/selections'
import { BASE_DIRS, ASSISTANT_DIRS } from '@/lib/services/workspace-dirs'
import { errorJson } from '@/lib/utils/api'

const CONTEXTS_DIR = path.join(os.homedir(), '.ai-frames', 'contexts')

function getRepoDir(id: string) { return path.join(CONTEXTS_DIR, id, 'repo', '.aicontext') }

function isSynced(wsPath: string, repoDir: string, rel: string, selections: Selections): boolean {
  if (!fs.existsSync(repoDir)) return true
  const parts = rel.replace(/^\.aicontext\/?/, '').split('/').filter(Boolean)
  const type = parts[0] as ResourceType
  const sub = parts[1]
  if (!type) return true
  const typeSelections = selections[type] ?? []
  if (typeSelections.length === 0) return true
  if (sub) {
    const subSelections = typeSelections.filter(s => s.startsWith(sub + '/'))
    if (subSelections.length === 0) return true
    const repoTypeDir = path.join(repoDir, type)
    try {
      for (const selected of subSelections) {
        const repoFile = path.join(repoTypeDir, selected)
        const wsFile = path.join(wsPath, '..', selected.replace(/^[^/]+\//, sub + '/'))
        if (!fs.existsSync(repoFile)) continue
        if (!fs.existsSync(wsFile)) return false
        if (fs.statSync(repoFile).mtimeMs > fs.statSync(wsFile).mtimeMs) return false
      }
      return true
    } catch { return true }
  }
  const flatSelections = typeSelections.filter(s => !s.includes('/'))
  if (flatSelections.length === 0) return true
  const repoTypeDir = path.join(repoDir, type)
  if (!fs.existsSync(repoTypeDir)) return true
  try {
    for (const selected of flatSelections) {
      const repoFile = path.join(repoTypeDir, selected)
      const wsFile = path.join(wsPath, selected)
      if (!fs.existsSync(repoFile)) continue
      if (!fs.existsSync(wsFile)) return false
      if (fs.statSync(repoFile).mtimeMs > fs.statSync(wsFile).mtimeMs) return false
    }
    return true
  } catch { return true }
}

export async function GET() {
  const context = getActiveContext()
  if (!context) return errorJson('context-not-found', 404)

  const ws = context.workspace
  const repoDir = getRepoDir(context.id)
  const selections = loadSelections(context.id)

  function dirEntry(rel: string) {
    const full = path.join(ws, rel)
    const exists = fs.existsSync(full)
    return { path: rel, exists, synced: exists ? isSynced(full, repoDir, rel, selections) : null }
  }

  const base = BASE_DIRS.map(dirEntry)
  const configuredAssistants = loadAssistants(context.id)
  const assistants: Record<string, { aicontext: ReturnType<typeof dirEntry>[]; native: ReturnType<typeof dirEntry>[]; in_repo: boolean }> = {}

  for (const [id, { aicontext, native }] of Object.entries(ASSISTANT_DIRS)) {
    const cfg = configuredAssistants.find(a => a.id === id)
    const prefix = cfg?.prefix ?? `.${id}`
    const aicontextDirs = aicontext.length > 0 ? aicontext : [
      `.aicontext/rules/${prefix}`, `.aicontext/agents/${prefix}`,
      `.aicontext/skills/${prefix}`, `.aicontext/prompts/${prefix}`,
    ]
    const firstAicontext = aicontextDirs[0]
    const inRepo = firstAicontext ? fs.existsSync(path.join(repoDir, firstAicontext.replace(/^\.aicontext\//, ''))) : false
    assistants[id] = { aicontext: aicontextDirs.map(dirEntry), native: native.map(dirEntry), in_repo: inRepo }
  }

  const customDirsFile = path.join(CONTEXTS_DIR, context.id, 'custom-dirs.yaml')
  const customMappings: { repo_path: string; local_path: string }[] = fs.existsSync(customDirsFile)
    ? parse(fs.readFileSync(customDirsFile, 'utf8')) ?? [] : []

  const custom = customMappings.map(m => {
    const localRel = m.local_path || `.aicontext/${m.repo_path}`
    const full = path.join(ws, localRel)
    const exists = fs.existsSync(full)
    const repoPath = path.join(CONTEXTS_DIR, context.id, 'repo', m.repo_path)
    let synced: boolean | null = null
    if (exists && fs.existsSync(repoPath)) {
      try { synced = fs.statSync(full).mtimeMs >= fs.statSync(repoPath).mtimeMs } catch { synced = true }
    }
    return { repo_path: m.repo_path, local_path: localRel, exists, synced }
  })

  return NextResponse.json({ workspace: ws, base, assistants, custom })
}
