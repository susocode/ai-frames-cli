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

// GET /api/custom-dirs/:assistant
customDirsRouter.get('/:assistant', (req, res) => {
  const context = getActiveContext()
  if (!context) { errorResponse(res, 'context-not-found', 404); return }
  const f = assistantCustomDirsFile(context.id, req.params.assistant)
  const mappings = fs.existsSync(f) ? parse(fs.readFileSync(f, 'utf8')) as DirMapping[] : []
  res.json({ mappings })
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
