import { Router } from 'express'
import { loadContextWithToken, loadGlobalConfig, configExists } from '../services/config.js'
import {
  cloneResourcesRepo,
  getLocalHash,
  getRemoteHash,
  pullResourcesRepo,
  syncToWorkspace,
  readLock,
  writeLock,
} from '../services/sync.js'
import { syncAllSelectionsToWorkspace } from '../routes/marketplace.js'
import { catchError, errorResponse } from '../utils/errors.js'
import { logger } from '../utils/logger.js'

export const repoSyncRouter = Router()

async function getContext() {
  if (!configExists()) return null
  const global = loadGlobalConfig()
  return loadContextWithToken(global.active_context)
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

// POST /api/repo-sync/clone — initial clone + sync selections to workspace
repoSyncRouter.post('/clone', async (_req, res) => {
  try {
    const context = await getContext()
    if (!context) { errorResponse(res, 'context-not-found', 404); return }

    await cloneResourcesRepo(context) // skips if already cloned
    await syncAllSelectionsToWorkspace(context.id, context.workspace)

    const hash = await getLocalHash(context.id)
    writeLock(context.id, { hash: hash ?? '', synced_at: new Date().toISOString() })

    logger.log(`repo-sync clone done hash=${hash}`)
    res.json({ ok: true, hash })
  } catch (err) {
    logger.log(`repo-sync clone failed: ${err instanceof Error ? err.message : String(err)}`)
    catchError(res, err)
  }
})

// POST /api/repo-sync/pull — pull latest + sync selections to workspace
repoSyncRouter.post('/pull', async (_req, res) => {
  try {
    const context = await getContext()
    if (!context) { errorResponse(res, 'context-not-found', 404); return }

    const hash = await pullResourcesRepo(context)
    await syncAllSelectionsToWorkspace(context.id, context.workspace)

    writeLock(context.id, { hash, synced_at: new Date().toISOString() })

    logger.log(`repo-sync pull done hash=${hash}`)
    res.json({ ok: true, hash })
  } catch (err) {
    logger.log(`repo-sync pull failed: ${err instanceof Error ? err.message : String(err)}`)
    catchError(res, err)
  }
})
