import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { loadContextWithToken, loadGlobalConfig, configExists } from '@/lib/services/config'
import { repoDir } from '@/lib/services/sync'
import { ResourceType } from '@/lib/services/selections'
import { catchJson, errorJson } from '@/lib/utils/api'

export async function GET(request: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params
  const filePath = new URL(request.url).searchParams.get('path')
  if (!configExists()) return errorJson('context-not-found', 404)
  if (!filePath) return errorJson('invalid-input')

  try {
    const global = loadGlobalConfig()
    const context = await loadContextWithToken(global.active_context)
    const full = path.join(repoDir(context.id), '.aicontext', type, filePath)
    if (!fs.existsSync(full)) return errorJson('repo-not-found', 404)
    const content = fs.readFileSync(full, 'utf8')
    const isYaml = filePath.endsWith('.yaml') || filePath.endsWith('.yml')
    const body = content.replace(/^---\n[\s\S]*?\n---\n?/, '').trim()
    return NextResponse.json({ content: body, raw: content, isYaml })
  } catch (err) {
    return catchJson(err)
  }
}
