import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { getActiveContext } from '@/lib/services/config'
import { getAssistantDirs } from '@/lib/services/workspace-dirs'
import { catchJson, errorJson } from '@/lib/utils/api'
import { logger } from '@/lib/utils/logger'

export async function POST(request: NextRequest) {
  const { assistant, enable, prefix } = await request.json() as { assistant: string; enable: boolean; prefix?: string }
  const context = getActiveContext()
  if (!context) return errorJson('context-not-found', 404)

  try {
    const ws = context.workspace
    const resolvedPrefix = prefix ?? `.${assistant}`
    const { aicontext } = getAssistantDirs(assistant, resolvedPrefix)

    if (enable) {
      for (const rel of aicontext) {
        const full = path.join(ws, rel)
        if (!fs.existsSync(full)) { fs.mkdirSync(full, { recursive: true }); logger.log(`workspace-dirs: created ${rel}`) }
      }
    } else {
      for (const rel of [...aicontext].reverse()) {
        const full = path.join(ws, rel)
        if (fs.existsSync(full)) { try { fs.rmSync(full, { recursive: true, force: true }) } catch (e) { logger.log(`workspace-dirs: failed to remove ${rel}: ${e}`) } }
      }
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    return catchJson(err)
  }
}
