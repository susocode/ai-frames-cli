import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { parse, stringify } from 'yaml'
import { getActiveContext } from '../services/config.js'
import { catchError, errorResponse } from '../utils/errors.js'

export const assistantsRouter = Router()

const CONFIG_DIR = path.join(os.homedir(), '.ai-frames')
const CONTEXTS_DIR = path.join(CONFIG_DIR, 'contexts')

export interface AssistantConfig {
  id: string
  label: string
  prefix: string         // e.g. .claude, .copilot
  enabled: boolean
}

// Default assistant definitions — used when no assistants.yaml exists yet
export const DEFAULT_ASSISTANTS: AssistantConfig[] = [
  { id: 'claude',   label: 'Claude Code',    prefix: '.claude',   enabled: false },
  { id: 'copilot',  label: 'GitHub Copilot', prefix: '.copilot',  enabled: false },
  { id: 'cursor',   label: 'Cursor',         prefix: '.cursor',   enabled: false },
  { id: 'windsurf', label: 'Windsurf',       prefix: '.windsurf', enabled: false },
]

function assistantsFile(id: string): string {
  return path.join(CONTEXTS_DIR, id, 'assistants.yaml')
}

export function loadAssistants(contextId: string): AssistantConfig[] {
  const f = assistantsFile(contextId)
  if (!fs.existsSync(f)) return DEFAULT_ASSISTANTS.map(a => ({ ...a }))
  return parse(fs.readFileSync(f, 'utf8')) as AssistantConfig[]
}

function saveAssistants(contextId: string, assistants: AssistantConfig[]): void {
  fs.writeFileSync(assistantsFile(contextId), stringify(assistants), 'utf8')
}

// GET /api/assistants/selections — return which resource types have selections for each assistant prefix
assistantsRouter.get('/selections', (_req, res) => {
  const context = getActiveContext()
  if (!context) { errorResponse(res, 'context-not-found', 404); return }
  const { loadSelections } = require('../services/selections.js')
  const selections = loadSelections(context.id)
  // For each assistant, check if any selection contains its prefix (e.g. '.claude/')
  const assistants = loadAssistants(context.id)
  const result: Record<string, boolean> = {}
  for (const a of assistants) {
    const hasSelections = Object.values(selections).some(
      (items: unknown) => Array.isArray(items) && (items as string[]).some(s => s.startsWith(a.prefix + '/'))
    )
    result[a.id] = hasSelections
  }
  res.json({ selections: result })
})

// GET /api/assistants
assistantsRouter.get('/', (_req, res) => {
  const context = getActiveContext()
  if (!context) { errorResponse(res, 'context-not-found', 404); return }
  res.json({ assistants: loadAssistants(context.id) })
})

// PUT /api/assistants — update enabled state of assistants
assistantsRouter.put('/', (req, res) => {
  const context = getActiveContext()
  if (!context) { errorResponse(res, 'context-not-found', 404); return }
  try {
    const assistants = req.body as AssistantConfig[]
    saveAssistants(context.id, assistants)
    res.json({ assistants })
  } catch (err) { catchError(res, err) }
})

// POST /api/assistants — add a new custom assistant
assistantsRouter.post('/', (req, res) => {
  const context = getActiveContext()
  if (!context) { errorResponse(res, 'context-not-found', 404); return }
  try {
    const { id, label, prefix } = req.body as { id: string; label: string; prefix: string }
    if (!id || !label || !prefix) { errorResponse(res, 'invalid-input'); return }
    const current = loadAssistants(context.id)
    if (current.find(a => a.id === id)) { errorResponse(res, 'context-already-exists'); return }
    const updated = [...current, { id, label, prefix, enabled: false }]
    saveAssistants(context.id, updated)
    res.status(201).json({ assistants: updated })
  } catch (err) { catchError(res, err) }
})
