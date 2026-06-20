import { NextResponse } from 'next/server'
import { loadContextWithToken, loadGlobalConfig, configExists } from '@/lib/services/config'
import { install } from '@/lib/services/installer'
import { catchJson, errorJson } from '@/lib/utils/api'

export async function POST() {
  try {
    if (!configExists()) return errorJson('context-not-found', 404)
    const global = loadGlobalConfig()
    if (!global?.active_context) return errorJson('context-not-found', 404)
    const context = await loadContextWithToken(global.active_context)
    await install(context)
    return NextResponse.json({ ok: true })
  } catch (err) { return catchJson(err) }
}
