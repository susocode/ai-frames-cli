import { Router } from 'express'
import { loadContextWithToken, loadGlobalConfig, configExists } from '../services/config.js'
import fs from 'fs'
import path from 'path'
import os from 'os'
import {
  cloneResourcesRepo,
  getLocalHash,
  getRemoteHash,
  pullResourcesRepo,
  syncToWorkspace,
  readLock,
  writeLock,
} from '../services/sync.js'
import { parse as parseYaml } from 'yaml'
import { BASE_DIRS, ASSISTANT_DIRS } from '../routes/workspace-dirs.js'
import { catchError, errorResponse } from '../utils/errors.js'
import { logger } from '../utils/logger.js'

export const repoSyncRouter = Router()

async function getContext() {
  if (!configExists()) return null
  const global = loadGlobalConfig()
  return loadContextWithToken(global.active_context)
}

function getConfiguredDirs(context: { id: string; workspace: string }) {
  const ws = context.workspace

  // Always include base .aicontext dirs (create if missing)
  const enabledDirs: string[] = [...BASE_DIRS.filter(d => d !== '.aicontext')]

  // For each assistant: include ALL its aicontext dirs if the assistant is enabled
  // (native root exists = assistant was enabled by user, even if some subdirs were deleted)
  for (const [, { aicontext, native }] of Object.entries(ASSISTANT_DIRS)) {
    const isEnabled = native.length > 0 && fs.existsSync(path.join(ws, native[0]))
    if (isEnabled) {
      enabledDirs.push(...aicontext)
    }
  }

  // Custom mappings
  const customDirsFile = path.join(os.homedir(), '.ai-frames', 'contexts', context.id, 'custom-dirs.yaml')
  const customMappings = fs.existsSync(customDirsFile)
    ? (parseYaml(fs.readFileSync(customDirsFile, 'utf8')) as { repo_path: string; local_path: string }[]) ?? []
    : []

  logger.log(`sync: ${enabledDirs.length} enabled dirs + ${customMappings.length} custom mappings`)
  return { enabledDirs, customMappings }
}

// GET /api/repo-sync/status — compare local hash vs remote
repoSyncRouter.get('/status', async (_req, res) => {
  try {
    const context = await getContext()
    if (!context) { errorResponse(res, 'context-not-found', 404); return }

    const lock = readLock(context.id)
    const localHash = await getLocalHash(context.id)
    const remoteHash = await getRemoteHash(context)

    res.json({
      local_hash: localHash,
      remote_hash: remoteHash,
      synced_at: lock?.synced_at ?? null,
      up_to_date: !!localHash && !!remoteHash && localHash === remoteHash,
      needs_clone: !localHash,
    })
  } catch (err) {
    logger.log(`repo-sync status failed: ${err instanceof Error ? err.message : String(err)}`)
    catchError(res, err)
  }
})

// POST /api/repo-sync/clone — initial clone + sync only configured dirs to workspace
repoSyncRouter.post('/clone', async (_req, res) => {
  try {
    const context = await getContext()
    if (!context) { errorResponse(res, 'context-not-found', 404); return }

    await cloneResourcesRepo(context) // skips if already cloned

    const { enabledDirs, customMappings } = getConfiguredDirs(context)
    await syncToWorkspace(context, enabledDirs, customMappings) // always syncs

    const hash = await getLocalHash(context.id)
    writeLock(context.id, {
      hash: hash ?? '',
      synced_at: new Date().toISOString(),
    })

    logger.log(`repo-sync clone done hash=${hash}`)
    res.json({ ok: true, hash })
  } catch (err) {
    logger.log(`repo-sync clone failed: ${err instanceof Error ? err.message : String(err)}`)
    catchError(res, err)
  }
})

// POST /api/repo-sync/pull — pull latest + sync only configured dirs to workspace
repoSyncRouter.post('/pull', async (_req, res) => {
  try {
    const context = await getContext()
    if (!context) { errorResponse(res, 'context-not-found', 404); return }

    const hash = await pullResourcesRepo(context)

    const { enabledDirs, customMappings } = getConfiguredDirs(context)
    await syncToWorkspace(context, enabledDirs, customMappings)

    writeLock(context.id, {
      hash,
      synced_at: new Date().toISOString(),
    })

    logger.log(`repo-sync pull done hash=${hash}`)
    res.json({ ok: true, hash })
  } catch (err) {
    logger.log(`repo-sync pull failed: ${err instanceof Error ? err.message : String(err)}`)
    catchError(res, err)
  }
})
