import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { getActiveContext } from '@/lib/services/config'
import { catchJson, errorJson } from '@/lib/utils/api'

export async function DELETE(request: NextRequest) {
  const context = getActiveContext()
  if (!context) return errorJson('context-not-found', 404)
  const { local_path } = await request.json() as { local_path: string }
  if (!local_path?.trim()) return errorJson('invalid-input')
  try {
    const full = path.join(context.workspace, local_path.trim())
    if (!full.startsWith(context.workspace)) return errorJson('invalid-input')
    if (fs.existsSync(full)) fs.rmSync(full, { recursive: true, force: true })
    return NextResponse.json({ ok: true })
  } catch (err) { return catchJson(err) }
}
