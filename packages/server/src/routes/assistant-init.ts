import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { loadContextWithToken, loadGlobalConfig, configExists } from '../services/config.js'
import { ASSISTANT_DIRS } from './workspace-dirs.js'
import { repoDir, syncToWorkspace, getLocalHash, writeLock } from '../services/sync.js'
import { catchError, errorResponse } from '../utils/errors.js'
import { logger } from '../utils/logger.js'

export const assistantInitRouter = Router()

// POST /api/assistant-init/:assistant
// Creates the assistant's .aicontext subdirs in the remote repo + syncs to workspace
assistantInitRouter.post('/:assistant', async (req, res) => {
  const { assistant } = req.params
  if (!configExists()) { errorResponse(res, 'context-not-found', 404); return }
  if (!ASSISTANT_DIRS[assistant]) { errorResponse(res, 'invalid-input'); return }

  try {
    const global = loadGlobalConfig()
    const context = await loadContextWithToken(global.active_context)
    const { provider, resources_repo, auth } = context

    if (!auth?.token) { errorResponse(res, 'no-token'); return }

    const { aicontext } = ASSISTANT_DIRS[assistant]
    const repoRoot = repoDir(context.id)

    // Create dirs in remote repo via API
    await createDirsInRepo(provider, resources_repo, auth.token, aicontext)

    // Pull the new commits into local clone
    const { simpleGit } = await import('simple-git')
    const git = simpleGit(repoRoot)
    await git.pull()

    // Sync to workspace
    await syncToWorkspace(context, aicontext)

    const hash = await getLocalHash(context.id)
    writeLock(context.id, { hash: hash ?? '', synced_at: new Date().toISOString() })

    logger.log(`assistant-init: ${assistant} done hash=${hash}`)
    res.json({ ok: true })
  } catch (err) {
    logger.log(`assistant-init failed: ${err instanceof Error ? err.message : String(err)}`)
    catchError(res, err)
  }
})

async function createDirsInRepo(
  provider: string,
  repo: string,
  token: string,
  dirs: string[]
): Promise<void> {
  for (const dir of dirs) {
    // Strip .aicontext/ prefix — repo stores just the subdir
    const repoPath = dir.replace(/^\.aicontext\//, '') + '/.gitkeep'
    await createFileInRepo(provider, repo, token, `.aicontext/${repoPath}`)
  }
}

async function createFileInRepo(
  provider: string,
  repo: string,
  token: string,
  filePath: string
): Promise<void> {
  const headers: Record<string, string> = { 'User-Agent': 'ai-frames', 'Content-Type': 'application/json' }

  if (provider === 'github') {
    headers['Authorization'] = `Bearer ${token}`
    const url = `https://api.github.com/repos/${repo}/contents/${filePath}`
    // Check if already exists
    const check = await fetch(url, { headers })
    if (check.ok) { logger.log(`assistant-init: ${filePath} already exists`); return }
    const res = await fetch(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ message: `init: add ${filePath}`, content: '' }),
    })
    if (!res.ok) {
      const err = await res.json() as { message?: string }
      throw new Error(`GitHub: failed to create ${filePath} — ${err.message}`)
    }
  } else if (provider === 'gitlab') {
    headers['PRIVATE-TOKEN'] = token
    const encoded = encodeURIComponent(repo)
    const encodedPath = encodeURIComponent(filePath)
    const url = `https://gitlab.com/api/v4/projects/${encoded}/repository/files/${encodedPath}`
    const check = await fetch(url + '?ref=main', { headers })
    if (check.ok) { logger.log(`assistant-init: ${filePath} already exists`); return }
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ branch: 'main', content: '', commit_message: `init: add ${filePath}` }),
    })
    if (!res.ok) {
      const err = await res.json() as { message?: string }
      throw new Error(`GitLab: failed to create ${filePath} — ${err.message}`)
    }
  } else if (provider === 'bitbucket') {
    const form = new FormData()
    form.append(filePath, new Blob(['']))
    form.append('message', `init: add ${filePath}`)
    const res = await fetch(`https://api.bitbucket.org/2.0/repositories/${repo}/src`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: form,
    })
    if (!res.ok) throw new Error(`Bitbucket: failed to create ${filePath}`)
  }
  logger.log(`assistant-init: created ${filePath}`)
}
