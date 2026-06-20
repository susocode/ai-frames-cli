import { NextResponse } from 'next/server'
import { loadContextWithToken, loadGlobalConfig, configExists } from '@/lib/services/config'
import { cloneResourcesRepo, getLocalHash, writeLock } from '@/lib/services/sync'
import { syncAllSelectionsToWorkspace } from '@/lib/services/marketplace'
import { catchJson, errorJson } from '@/lib/utils/api'
import { logger } from '@/lib/utils/logger'

export async function POST() {
  if (!configExists()) return errorJson('context-not-found', 404)
  try {
    const global = loadGlobalConfig()
    const context = await loadContextWithToken(global.active_context)
    await cloneResourcesRepo(context)
    await syncAllSelectionsToWorkspace(context.id, context.workspace)
    const hash = await getLocalHash(context.id)
    writeLock(context.id, { hash: hash ?? '', synced_at: new Date().toISOString() })
    logger.log(`repo-sync clone done hash=${hash}`)
    return NextResponse.json({ ok: true, hash })
  } catch (err) {
    return catchJson(err)
  }
}
