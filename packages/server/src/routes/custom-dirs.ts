import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { parse, stringify } from 'yaml'
import { getActiveContext } from '../services/config.js'
import { catchError, errorResponse } from '../utils/errors.js'

export const customDirsRouter = Router()

const CONFIG_DIR = path.join(os.homedir(), '.ai-frames')
const CONTEXTS_DIR = path.join(CONFIG_DIR, 'contexts')

export interface DirMapping {
  repo_path: string    // path in the resources repo (relative to root)
  local_path: string   // path in .aicontext/ (defaults to repo_path if empty)
}

function customDirsFile(id: string): string {
  return path.join(CONTEXTS_DIR, id, 'custom-dirs.yaml')
}

function assistantCustomDirsFile(id: string, assistant: string): string {
  return path.join(CONTEXTS_DIR, id, `custom-dirs-${assistant}.yaml`)
}

function loadMappings(id: string): DirMapping[] {
  const f = customDirsFile(id)
  if (!fs.existsSync(f)) return []
  return parse(fs.readFileSync(f, 'utf8')) as DirMapping[]
}

function saveMappings(id: string, mappings: DirMapping[]): void {
  fs.writeFileSync(customDirsFile(id), stringify(mappings), 'utf8')
}

// GET /api/custom-dirs
customDirsRouter.get('/', (_req, res) => {
  const context = getActiveContext()
  if (!context) { errorResponse(res, 'context-not-found', 404); return }
  res.json({ mappings: loadMappings(context.id) })
})

// DELETE /api/custom-dirs/local — remove the local directory for a mapping
customDirsRouter.delete('/local', (req, res) => {
  const context = getActiveContext()
  if (!context) { errorResponse(res, 'context-not-found', 404); return }
  const { local_path } = req.body as { local_path: string }
  if (!local_path?.trim()) { errorResponse(res, 'invalid-input'); return }
  try {
    const full = path.join(context.workspace, local_path.trim())
    // Safety: must be inside the workspace
    if (!full.startsWith(context.workspace)) {
      errorResponse(res, 'invalid-input')
      return
    }
    if (fs.existsSync(full)) {
      fs.rmSync(full, { recursive: true, force: true })
    }
    res.json({ ok: true })
  } catch (err) { catchError(res, err) }
})

// GET /api/custom-dirs/:assistant
customDirsRouter.get('/:assistant', (req, res) => {
  const context = getActiveContext()
  if (!context) { errorResponse(res, 'context-not-found', 404); return }
  const f = assistantCustomDirsFile(context.id, req.params.assistant)
  const mappings: DirMapping[] = fs.existsSync(f) ? parse(fs.readFileSync(f, 'utf8')) ?? [] : []

  // Enrich with exists status from workspace
  const entries = mappings.map(m => {
    const localRel = m.local_path || (
      m.repo_path.startsWith('.aicontext/') ? m.repo_path : `.aicontext/${m.repo_path}`
    )
    const full = path.join(context.workspace, localRel)
    return {
      ...m,
      path: localRel,
      exists: fs.existsSync(full),
      synced: null as null,
    }
  })

  res.json({ mappings, entries })
})

// PUT /api/custom-dirs/:assistant
customDirsRouter.put('/:assistant', (req, res) => {
  const context = getActiveContext()
  if (!context) { errorResponse(res, 'context-not-found', 404); return }
  try {
    const mappings = (req.body as DirMapping[]).filter(m => m.repo_path?.trim())
    fs.writeFileSync(assistantCustomDirsFile(context.id, req.params.assistant), stringify(mappings), 'utf8')
    res.json({ ok: true, mappings })
  } catch (err) { catchError(res, err) }
})

// PUT /api/custom-dirs
customDirsRouter.put('/', (req, res) => {
  const context = getActiveContext()
  if (!context) { errorResponse(res, 'context-not-found', 404); return }
  try {
    const mappings = req.body as DirMapping[]
    // Normalize: if local_path empty, use repo_path
    const normalized = mappings.map(m => ({
      repo_path: m.repo_path.trim(),
      // If local_path is empty, default to .aicontext/<repo_path>
      // If user provides a path (with or without .aicontext/ prefix), use it as-is
      local_path: m.local_path.trim() || (
        m.repo_path.trim().startsWith('.aicontext/')
          ? m.repo_path.trim()
          : `.aicontext/${m.repo_path.trim()}`
      ),
    })).filter(m => m.repo_path)
    saveMappings(context.id, normalized)
    res.json({ ok: true, mappings: normalized })
  } catch (err) {
    catchError(res, err)
  }
})
