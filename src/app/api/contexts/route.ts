import { NextRequest, NextResponse } from 'next/server'
import { configExists, listContexts, addContext, getActiveContext, Context } from '@/lib/services/config'
import { errorJson, catchJson } from '@/lib/utils/api'
import { logger } from '@/lib/utils/logger'

function sanitize(c: Context | null) {
  return c ? { ...c, auth: { ...c.auth, token: undefined } } : null
}

export async function GET() {
  try {
    const setup_required = !configExists()
    if (setup_required) return NextResponse.json({ setup_required: true, active: null, contexts: [] })
    const contexts = listContexts()
    const active = getActiveContext()
    return NextResponse.json({ setup_required: false, active: sanitize(active), contexts: contexts.map(c => sanitize(c)!) })
  } catch (err) {
    logger.error(`GET /api/contexts failed: ${err instanceof Error ? err.message : String(err)}`)
    return NextResponse.json({ setup_required: false, active: null, contexts: [], code: 'unknown-error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json() as Omit<Context, 'id'>
  if (!body.name || !body.workspace || !body.resources_repo) return errorJson('invalid-input')
  try {
    const created = await addContext(body)
    return NextResponse.json({ ...created, auth: { ...created.auth, token: undefined } }, { status: 201 })
  } catch (err) {
    return catchJson(err)
  }
}
