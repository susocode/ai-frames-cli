import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { getActiveContext } from '@/lib/services/config'
import { BASE_DIRS, ASSISTANT_DIRS } from '@/lib/services/workspace-dirs'
import { catchJson, errorJson } from '@/lib/utils/api'
import { logger } from '@/lib/utils/logger'

const EXPECTED_DIRS = [
  ...BASE_DIRS,
  ...Object.values(ASSISTANT_DIRS).flatMap(a => [...a.aicontext, ...a.native]),
]

export async function POST() {
  const context = getActiveContext()
  if (!context) return errorJson('context-not-found', 404)
  try {
    const ws = context.workspace
    let created = 0
    for (const rel of EXPECTED_DIRS) {
      const full = path.join(ws, rel)
      if (!fs.existsSync(full)) { fs.mkdirSync(full, { recursive: true }); logger.log(`workspace-dirs: created ${rel}`); created++ }
    }
    return NextResponse.json({ ok: true, created })
  } catch (err) {
    return catchJson(err)
  }
}
