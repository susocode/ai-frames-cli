import { NextResponse } from 'next/server'
import { loadContextWithToken, loadGlobalConfig, configExists } from '@/lib/services/config'
import { cloneResourcesRepo, syncToWorkspace, getLocalHash, writeLock } from '@/lib/services/sync'
import { catchJson, errorJson } from '@/lib/utils/api'
import { logger } from '@/lib/utils/logger'

const INITIAL_STRUCTURE = [
  { path: '.aicontext/rules/.gitkeep', content: '' },
  { path: '.aicontext/agents/.gitkeep', content: '' },
  { path: '.aicontext/skills/.gitkeep', content: '' },
  { path: '.aicontext/prompts/.gitkeep', content: '' },
  { path: '.aicontext/mcps/.gitkeep', content: '' },
  { path: '.aicontext/contexts/.gitkeep', content: '' },
  { path: '.aicontext/templates/.gitkeep', content: '' },
  { path: '.aicontext/README.md', content: '# AI Context\n\nManaged by [ai-frames](https://ai-frames.org).\n' },
]

export async function POST() {
  if (!configExists()) return errorJson('context-not-found', 404)
  try {
    const global = loadGlobalConfig()
    const context = await loadContextWithToken(global.active_context)
    if (!context.auth?.token) return errorJson('no-token')

    await initRepo(context.provider, context.resources_repo, context.auth.token)
    await cloneResourcesRepo(context)
    await syncToWorkspace(context)
    const hash = await getLocalHash(context.id)
    writeLock(context.id, { hash: hash ?? '', synced_at: new Date().toISOString() })

    return NextResponse.json({ ok: true, hash })
  } catch (err) {
    return catchJson(err)
  }
}

async function initRepo(provider: string, repo: string, token: string): Promise<void> {
  if (provider === 'github') {
    const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'ai-frames' }
    for (const file of INITIAL_STRUCTURE) {
      const res = await fetch(`https://api.github.com/repos/${repo}/contents/${file.path}`, {
        method: 'PUT', headers,
        body: JSON.stringify({ message: `init: add ${file.path}`, content: Buffer.from(file.content).toString('base64') }),
      })
      if (!res.ok) { const err = await res.json() as { message?: string }; throw new Error(`GitHub: failed to create ${file.path} — ${err.message}`) }
    }
  } else if (provider === 'gitlab') {
    const encoded = encodeURIComponent(repo)
    const headers = { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' }
    for (const file of INITIAL_STRUCTURE) {
      const res = await fetch(`https://gitlab.com/api/v4/projects/${encoded}/repository/files/${encodeURIComponent(file.path)}`, {
        method: 'POST', headers,
        body: JSON.stringify({ branch: 'main', content: file.content, commit_message: `init: add ${file.path}` }),
      })
      if (!res.ok) { const err = await res.json() as { message?: string }; throw new Error(`GitLab: failed to create ${file.path} — ${err.message}`) }
    }
  } else {
    for (const file of INITIAL_STRUCTURE) {
      const form = new FormData()
      form.append(file.path, new Blob([file.content]), file.path)
      form.append('message', `init: add ${file.path}`)
      const res = await fetch(`https://api.bitbucket.org/2.0/repositories/${repo}/src`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: form,
      })
      if (!res.ok) throw new Error(`Bitbucket: failed to create ${file.path}`)
    }
  }
}
