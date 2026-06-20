import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import { loadContextWithToken, loadGlobalConfig, configExists } from '@/lib/services/config'
import { ASSISTANT_DIRS } from '@/lib/services/workspace-dirs'
import { repoDir, syncToWorkspace, getLocalHash, writeLock } from '@/lib/services/sync'
import { catchJson, errorJson } from '@/lib/utils/api'
import { logger } from '@/lib/utils/logger'
import path from 'path'

export async function POST(_request: NextRequest, { params }: { params: Promise<{ assistant: string }> }) {
  const { assistant } = await params
  if (!configExists()) return errorJson('context-not-found', 404)
  if (!ASSISTANT_DIRS[assistant]) return errorJson('invalid-input')

  try {
    const global = loadGlobalConfig()
    const context = await loadContextWithToken(global.active_context)
    if (!context.auth?.token) return errorJson('no-token')

    const { aicontext } = ASSISTANT_DIRS[assistant]
    const repoRoot = repoDir(context.id)

    await createDirsInRepo(context.provider, context.resources_repo, context.auth.token, aicontext)

    const { simpleGit } = await import('simple-git')
    await simpleGit(repoRoot).pull()
    await syncToWorkspace(context, aicontext)

    const hash = await getLocalHash(context.id)
    writeLock(context.id, { hash: hash ?? '', synced_at: new Date().toISOString() })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return catchJson(err)
  }
}

async function createDirsInRepo(provider: string, repo: string, token: string, dirs: string[]): Promise<void> {
  for (const dir of dirs) {
    const repoPath = dir.replace(/^\.aicontext\//, '') + '/.gitkeep'
    await createFileInRepo(provider, repo, token, `.aicontext/${repoPath}`)
  }
}

async function createFileInRepo(provider: string, repo: string, token: string, filePath: string): Promise<void> {
  const headers: Record<string, string> = { 'User-Agent': 'ai-frames', 'Content-Type': 'application/json' }
  if (provider === 'github') {
    headers['Authorization'] = `Bearer ${token}`
    const url = `https://api.github.com/repos/${repo}/contents/${filePath}`
    const check = await fetch(url, { headers })
    if (check.ok) return
    const res = await fetch(url, { method: 'PUT', headers, body: JSON.stringify({ message: `init: add ${filePath}`, content: '' }) })
    if (!res.ok) { const err = await res.json() as { message?: string }; throw new Error(`GitHub: failed to create ${filePath} — ${err.message}`) }
  } else if (provider === 'gitlab') {
    headers['PRIVATE-TOKEN'] = token
    const encoded = encodeURIComponent(repo)
    const encodedPath = encodeURIComponent(filePath)
    const url = `https://gitlab.com/api/v4/projects/${encoded}/repository/files/${encodedPath}`
    const check = await fetch(url + '?ref=main', { headers })
    if (check.ok) return
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ branch: 'main', content: '', commit_message: `init: add ${filePath}` }) })
    if (!res.ok) throw new Error(`GitLab: failed to create ${filePath}`)
  } else {
    const form = new FormData()
    form.append(filePath, new Blob(['']))
    form.append('message', `init: add ${filePath}`)
    const res = await fetch(`https://api.bitbucket.org/2.0/repositories/${repo}/src`, {
      method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: form,
    })
    if (!res.ok) throw new Error(`Bitbucket: failed to create ${filePath}`)
  }
  logger.log(`assistant-init: created ${filePath}`)
}
