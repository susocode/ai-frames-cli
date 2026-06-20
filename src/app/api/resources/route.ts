import { NextRequest, NextResponse } from 'next/server'
import { getActiveContext } from '@/lib/services/config'
import { manifestExists, loadManifest, saveManifest } from '@/lib/services/manifest'
import { catchJson, errorJson } from '@/lib/utils/api'

export async function GET() {
  const context = getActiveContext()
  if (!context) return errorJson('context-not-found', 404)
  try {
    if (!manifestExists(context.workspace)) return NextResponse.json({ manifest: null })
    return NextResponse.json({ manifest: loadManifest(context.workspace) })
  } catch (err) { return catchJson(err) }
}

export async function PUT(request: NextRequest) {
  const context = getActiveContext()
  if (!context) return errorJson('context-not-found', 404)
  try {
    saveManifest(context.workspace, await request.json())
    return NextResponse.json({ ok: true })
  } catch (err) { return catchJson(err) }
}
