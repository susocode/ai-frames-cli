import { Router } from 'express'
import { loadContextWithToken, loadGlobalConfig, configExists } from '../services/config.js'
import { cloneResourcesRepo, syncToWorkspace, getLocalHash, writeLock } from '../services/sync.js'
import { catchError, errorResponse } from '../utils/errors.js'
import { logger } from '../utils/logger.js'

export const repoInitRouter = Router()

const INITIAL_STRUCTURE = [
  { path: '.aicontext/rules/.gitkeep', content: '' },
  { path: '.aicontext/agents/.gitkeep', content: '' },
  { path: '.aicontext/skills/.gitkeep', content: '' },
  { path: '.aicontext/prompts/.gitkeep', content: '' },
  { path: '.aicontext/mcps/.gitkeep', content: '' },
  { path: '.aicontext/memory/.gitkeep', content: '' },
  { path: '.aicontext/README.md', content: '# AI Context\n\nThis repository contains the shared AI context for all repositories in this workspace.\n\n## Structure\n\n- `rules/` — Mandatory rules always included in the AI context\n- `agents/` — Specialized AI subagent definitions\n- `skills/` — Reusable slash commands\n- `prompts/` — Reusable prompt templates\n- `mcps/` — MCP server configurations\n- `memory/` — Persistent memory across sessions\n' },
]

repoInitRouter.post('/', async (_req, res) => {
  if (!configExists()) {
    errorResponse(res, 'context-not-found', 404)
    return
  }
  try {
    const global = loadGlobalConfig()
    const context = await loadContextWithToken(global.active_context)
    const { provider, resources_repo, auth } = context

    if (!auth?.token) {
      errorResponse(res, 'no-token')
      return
    }

    await initRepo(provider, resources_repo, auth.token)

    // Clone the newly created repo and sync to workspace
    await cloneResourcesRepo(context)
    await syncToWorkspace(context)
    const hash = await getLocalHash(context.id)
    writeLock(context.id, { hash: hash ?? '', synced_at: new Date().toISOString() })

    logger.log(`repo-init complete hash=${hash}`)
    res.json({ ok: true, hash })
  } catch (err) {
    logger.log(`repo-init failed: ${err instanceof Error ? err.message : String(err)}`)
    catchError(res, err)
  }
})

async function initRepo(provider: string, repo: string, token: string): Promise<void> {
  if (provider === 'github') {
    await initGithub(repo, token)
  } else if (provider === 'gitlab') {
    await initGitlab(repo, token)
  } else if (provider === 'bitbucket') {
    await initBitbucket(repo, token)
  }
}

async function initGithub(repo: string, token: string): Promise<void> {
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'User-Agent': 'ai-frames',
  }

  for (const file of INITIAL_STRUCTURE) {
    const url = `https://api.github.com/repos/${repo}/contents/${file.path}`
    const body = {
      message: `init: add ${file.path}`,
      content: Buffer.from(file.content).toString('base64'),
    }
    const res = await fetch(url, { method: 'PUT', headers, body: JSON.stringify(body) })
    if (!res.ok) {
      const err = await res.json() as { message?: string }
      throw new Error(`GitHub: failed to create ${file.path} — ${err.message}`)
    }
    logger.log(`repo-init: created ${file.path}`)
  }
}

async function initGitlab(repo: string, token: string): Promise<void> {
  const encoded = encodeURIComponent(repo)
  const headers = { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' }

  for (const file of INITIAL_STRUCTURE) {
    const url = `https://gitlab.com/api/v4/projects/${encoded}/repository/files/${encodeURIComponent(file.path)}`
    const body = {
      branch: 'main',
      content: file.content,
      commit_message: `init: add ${file.path}`,
    }
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
    if (!res.ok) {
      const err = await res.json() as { message?: string }
      throw new Error(`GitLab: failed to create ${file.path} — ${err.message}`)
    }
    logger.log(`repo-init: created ${file.path}`)
  }
}

async function initBitbucket(repo: string, token: string): Promise<void> {
  const headers = { 'Authorization': `Bearer ${token}` }

  for (const file of INITIAL_STRUCTURE) {
    const form = new FormData()
    form.append(file.path, new Blob([file.content]), file.path)
    form.append('message', `init: add ${file.path}`)

    const url = `https://api.bitbucket.org/2.0/repositories/${repo}/src`
    const res = await fetch(url, { method: 'POST', headers, body: form })
    if (!res.ok) {
      throw new Error(`Bitbucket: failed to create ${file.path}`)
    }
    logger.log(`repo-init: created ${file.path}`)
  }
}
