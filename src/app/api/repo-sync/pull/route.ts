import { NextResponse } from 'next/server'
import { loadContextWithToken, loadGlobalConfig, configExists } from '@/lib/services/config'
import { pullResourcesRepo, writeLock } from '@/lib/services/sync'
import { syncAllSelectionsToWorkspace } from '@/lib/services/marketplace'
import { catchJson, errorJson } from '@/lib/utils/api'
import { logger } from '@/lib/utils/logger'

export async function POST() {
  if (!configExists()) return errorJson('context-not-found', 404)
  try {
    const global = loadGlobalConfig()
    const context = await loadContextWithToken(global.active_context)
    const hash = await pullResourcesRepo(context)
    await syncAllSelectionsToWorkspace(context.id, context.workspace)
    writeLock(context.id, { hash, synced_at: new Date().toISOString() })
    logger.log(`repo-sync pull done hash=${hash}`)
    return NextResponse.json({ ok: true, hash })
  } catch (err) {
    return catchJson(err)
  }
}
