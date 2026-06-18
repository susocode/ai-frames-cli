import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { parse } from 'yaml'
import { getActiveContext } from '../services/config.js'
import { catchError, errorResponse } from '../utils/errors.js'
import { logger } from '../utils/logger.js'

const CONFIG_DIR = path.join(os.homedir(), '.ai-frames')
const CONTEXTS_DIR = path.join(CONFIG_DIR, 'contexts')

function getRepoDir(id: string) {
  return path.join(CONTEXTS_DIR, id, 'repo', '.aicontext')
}

function isSynced(wsPath: string, repoDir: string, rel: string): boolean {
  if (!fs.existsSync(repoDir)) return true // no repo cloned yet — don't show as outdated
  const repoSubdir = rel.replace(/^\.aicontext\/?/, '')
  const repoPath = path.join(repoDir, repoSubdir || '.')
  if (!fs.existsSync(repoPath)) return true // not in repo — not applicable
  // Compare mtimes: if workspace dir is older than repo dir, it may be outdated
  try {
    const wsStat = fs.statSync(wsPath)
    const repoStat = fs.statSync(repoPath)
    return wsStat.mtimeMs >= repoStat.mtimeMs
  } catch {
    return true
  }
}

export const workspaceDirsRouter = Router()

// Base .aicontext structure — always present, assistant-agnostic
export const BASE_DIRS = [
  '.aicontext',
  '.aicontext/rules',
  '.aicontext/agents',
  '.aicontext/skills',
  '.aicontext/prompts',
  '.aicontext/mcps',
  '.aicontext/memory',
]

// Per-assistant subdirs inside .aicontext/ + their native workspace dirs
export const ASSISTANT_DIRS: Record<string, { aicontext: string[]; native: string[] }> = {
  claude: {
    aicontext: [
      '.aicontext/rules/.claude',
      '.aicontext/agents/.claude',
      '.aicontext/skills/.claude',
      '.aicontext/prompts/.claude',
    ],
    native: [
      '.claude',
      '.claude/rules',
      '.claude/agents',
      '.claude/skills',
      '.claude/commands',
    ],
  },
  copilot: {
    aicontext: [
      '.aicontext/rules/.copilot',
      '.aicontext/agents/.copilot',
      '.aicontext/skills/.copilot',
      '.aicontext/prompts/.copilot',
    ],
    native: [
      '.github',
      '.github/instructions',
      '.github/agents',
      '.github/skills',
      '.github/prompts',
    ],
  },
  cursor: {
    aicontext: [
      '.aicontext/rules/.cursor',
    ],
    native: [
      '.cursor',
      '.cursor/rules',
    ],
  },
  vscode: {
    aicontext: [],
    native: [
      '.vscode',
    ],
  },
  windsurf: {
    aicontext: [
      '.aicontext/rules/.windsurf',
      '.aicontext/prompts/.windsurf',
    ],
    native: [
      '.windsurf',
      '.windsurf/rules',
      '.windsurf/workflows',
    ],
  },
}

const EXPECTED_DIRS = [
  ...BASE_DIRS,
  ...Object.values(ASSISTANT_DIRS).flatMap(a => [...a.aicontext, ...a.native]),
]

// GET /api/workspace-dirs — check status of each expected directory
workspaceDirsRouter.get('/', (_req, res) => {
  const context = getActiveContext()
  if (!context) {
    errorResponse(res, 'context-not-found', 404)
    return
  }

  const ws = context.workspace
  const repoDir = getRepoDir(context.id)

  function dirEntry(rel: string) {
    const full = path.join(ws, rel)
    const exists = fs.existsSync(full)
    return {
      path: rel,
      exists,
      synced: exists ? isSynced(full, repoDir, rel) : null,
    }
  }

  const base = BASE_DIRS.map(dirEntry)

  const assistants: Record<string, { aicontext: ReturnType<typeof dirEntry>[]; native: ReturnType<typeof dirEntry>[]; in_repo: boolean }> = {}
  for (const [id, { aicontext, native }] of Object.entries(ASSISTANT_DIRS)) {
    // Check if this assistant's aicontext dirs exist in the cloned repo
    const firstAicontext = aicontext[0]
    const inRepo = firstAicontext
      ? fs.existsSync(path.join(repoDir, firstAicontext.replace(/^\.aicontext\//, '')))
      : false
    assistants[id] = {
      aicontext: aicontext.map(dirEntry),
      native: native.map(dirEntry),
      in_repo: inRepo,
    }
  }

  // Custom dir mappings
  const customDirsFile = path.join(CONTEXTS_DIR, context.id, 'custom-dirs.yaml')
  const customMappings: { repo_path: string; local_path: string }[] = fs.existsSync(customDirsFile)
    ? parse(fs.readFileSync(customDirsFile, 'utf8')) ?? []
    : []

  const custom = customMappings.map(m => {
    const localRel = m.local_path || `.aicontext/${m.repo_path}`
    const full = path.join(ws, localRel)
    const exists = fs.existsSync(full)
    // Check sync against repo (repo_path is relative to repo root)
    const repoPath = path.join(CONTEXTS_DIR, context.id, 'repo', m.repo_path)
    let synced: boolean | null = null
    if (exists && fs.existsSync(repoPath)) {
      try {
        const wsStat = fs.statSync(full)
        const repoStat = fs.statSync(repoPath)
        synced = wsStat.mtimeMs >= repoStat.mtimeMs
      } catch { synced = true }
    }
    return { repo_path: m.repo_path, local_path: localRel, exists, synced }
  })

  res.json({ workspace: ws, base, assistants, custom })
})

// POST /api/workspace-dirs/assistant — enable (create) or disable (remove) dirs for one assistant
workspaceDirsRouter.post('/assistant', (req, res) => {
  const { assistant, enable } = req.body as { assistant: string; enable: boolean }
  const context = getActiveContext()
  if (!context) { errorResponse(res, 'context-not-found', 404); return }
  if (!ASSISTANT_DIRS[assistant]) { errorResponse(res, 'invalid-input'); return }

  try {
    const ws = context.workspace
    const { aicontext, native } = ASSISTANT_DIRS[assistant]
    // Only create/remove aicontext subdirs — native dirs (.claude, .github etc)
    // are managed by the assistant itself, not by ai-frames
    const allDirs = aicontext

    if (enable) {
      for (const rel of allDirs) {
        const full = path.join(ws, rel)
        if (!fs.existsSync(full)) {
          fs.mkdirSync(full, { recursive: true })
          logger.log(`workspace-dirs: created ${rel}`)
        }
      }
    } else {
      for (const rel of [...allDirs].reverse()) {
        const full = path.join(ws, rel)
        if (fs.existsSync(full)) {
          try {
            fs.rmdirSync(full)
            logger.log(`workspace-dirs: removed ${rel}`)
          } catch {
            logger.log(`workspace-dirs: skipped non-empty ${rel}`)
          }
        }
      }
    }
    res.json({ ok: true })
  } catch (err) {
    catchError(res, err)
  }
})

// POST /api/workspace-dirs/recreate — create any missing directories
workspaceDirsRouter.post('/recreate', (_req, res) => {
  const context = getActiveContext()
  if (!context) {
    errorResponse(res, 'context-not-found', 404)
    return
  }

  try {
    const ws = context.workspace
    let created = 0
    for (const rel of EXPECTED_DIRS) {
      const full = path.join(ws, rel)
      if (!fs.existsSync(full)) {
        fs.mkdirSync(full, { recursive: true })
        logger.log(`workspace-dirs: created ${rel}`)
        created++
      }
    }
    res.json({ ok: true, created })
  } catch (err) {
    catchError(res, err)
  }
})
