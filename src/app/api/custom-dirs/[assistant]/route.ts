import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { parse, stringify } from 'yaml'
import { getActiveContext } from '@/lib/services/config'
import { catchJson, errorJson } from '@/lib/utils/api'

const CONTEXTS_DIR = path.join(os.homedir(), '.ai-frames', 'contexts')

interface DirMapping { repo_path: string; local_path: string }

function assistantFile(id: string, assistant: string) { return path.join(CONTEXTS_DIR, id, `custom-dirs-${assistant}.yaml`) }

export async function GET(_request: NextRequest, { params }: { params: Promise<{ assistant: string }> }) {
  const { assistant } = await params
  const context = getActiveContext()
  if (!context) return errorJson('context-not-found', 404)
  const f = assistantFile(context.id, assistant)
  const mappings: DirMapping[] = fs.existsSync(f) ? parse(fs.readFileSync(f, 'utf8')) ?? [] : []
  const entries = mappings.map(m => {
    const localRel = m.local_path || (m.repo_path.startsWith('.aicontext/') ? m.repo_path : `.aicontext/${m.repo_path}`)
    const full = path.join(context.workspace, localRel)
    return { ...m, path: localRel, exists: fs.existsSync(full), synced: null as null }
  })
  return NextResponse.json({ mappings, entries })
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ assistant: string }> }) {
  const { assistant } = await params
  const context = getActiveContext()
  if (!context) return errorJson('context-not-found', 404)
  try {
    const mappings = (await request.json() as DirMapping[]).filter(m => m.repo_path?.trim())
    fs.writeFileSync(assistantFile(context.id, assistant), stringify(mappings), 'utf8')
    return NextResponse.json({ ok: true, mappings })
  } catch (err) { return catchJson(err) }
}
