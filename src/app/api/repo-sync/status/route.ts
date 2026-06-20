import { NextResponse } from 'next/server'
import { loadContextWithToken, loadGlobalConfig, configExists } from '@/lib/services/config'
import { getLocalHash, getRemoteHash, readLock } from '@/lib/services/sync'
import { catchJson, errorJson } from '@/lib/utils/api'

export async function GET() {
  if (!configExists()) return errorJson('context-not-found', 404)
  try {
    const global = loadGlobalConfig()
    const context = await loadContextWithToken(global.active_context)
    const lock = readLock(context.id)
    const localHash = await getLocalHash(context.id)
    const remoteHash = await getRemoteHash(context)
    return NextResponse.json({
      local_hash: localHash,
      remote_hash: remoteHash,
      synced_at: lock?.synced_at ?? null,
      up_to_date: !!localHash && !!remoteHash && localHash === remoteHash,
      needs_clone: !localHash,
    })
  } catch (err) {
    return catchJson(err)
  }
}
