import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { parse, stringify } from 'yaml'
import { getActiveContext } from '@/lib/services/config'
import { catchJson, errorJson } from '@/lib/utils/api'

const CONTEXTS_DIR = path.join(os.homedir(), '.ai-frames', 'contexts')

interface DirMapping { repo_path: string; local_path: string }

function customDirsFile(id: string) { return path.join(CONTEXTS_DIR, id, 'custom-dirs.yaml') }
function loadMappings(id: string): DirMapping[] {
  const f = customDirsFile(id)
  if (!fs.existsSync(f)) return []
  return parse(fs.readFileSync(f, 'utf8')) as DirMapping[]
}

export async function GET() {
  const context = getActiveContext()
  if (!context) return errorJson('context-not-found', 404)
  return NextResponse.json({ mappings: loadMappings(context.id) })
}

export async function PUT(request: NextRequest) {
  const context = getActiveContext()
  if (!context) return errorJson('context-not-found', 404)
  try {
    const mappings = await request.json() as DirMapping[]
    const normalized = mappings.map(m => ({
      repo_path: m.repo_path.trim(),
      local_path: m.local_path.trim() || (m.repo_path.trim().startsWith('.aicontext/') ? m.repo_path.trim() : `.aicontext/${m.repo_path.trim()}`),
    })).filter(m => m.repo_path)
    fs.writeFileSync(customDirsFile(context.id), stringify(normalized), 'utf8')
    return NextResponse.json({ ok: true, mappings: normalized })
  } catch (err) { return catchJson(err) }
}
