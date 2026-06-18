import { Router } from 'express'
import { logger } from '../utils/logger.js'
import { normalizeRepo } from '../utils/repo.js'
import { AppError, catchError } from '../utils/errors.js'

export const repoCreateRouter = Router()

interface CreateRepoBody {
  provider: 'github' | 'gitlab' | 'bitbucket'
  name: string
  auth: { type: string; token?: string }
}

repoCreateRouter.post('/', async (req, res) => {
  const { provider, name, auth } = req.body as CreateRepoBody

  if (!provider || !name || !auth?.token) {
    res.status(400).json({ error: 'provider, name and auth.token are required' })
    return
  }

  try {
    const normalized = normalizeRepo(name)
    const parts = normalized.split('/')
    const repoName = parts[parts.length - 1]
    const org = parts.length >= 2 ? parts[0] : null
    const full_name = await createRepo(provider, repoName, auth.token, org ?? undefined)
    res.json({ full_name })
  } catch (err) {
    logger.log(`repo-create failed: ${err instanceof Error ? err.message : String(err)}`)
    catchError(res, err)
  }
})

async function createRepo(provider: string, name: string, token: string, org?: string): Promise<string> {
  if (provider === 'github') {
    const url = org
      ? `https://api.github.com/orgs/${org}/repos`
      : 'https://api.github.com/user/repos'
    logger.log(`github create repo url="${url}" name="${name}"`)
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'ai-frames',
      },
      body: JSON.stringify({ name, private: false, auto_init: true }),
    })
    if (!res.ok) {
      const err = await res.json() as { message?: string; errors?: { message?: string }[] }
      logger.log(`github create failed status=${res.status} body=${JSON.stringify(err)}`)
      if (res.status === 422) {
        const detail = err.errors?.[0]?.message ?? err.message ?? ''
        if (detail.toLowerCase().includes('already exist') || detail.toLowerCase().includes('name already')) {
          throw new AppError('repo-already-exists', `Repository already exists`)
        }
        throw new AppError('invalid-name', `Invalid repository name`)
      }
      if (res.status === 401 || res.status === 403) throw new AppError('auth-failed', 'Authentication failed')
      if (res.status === 404) throw new AppError('org-not-found', `Organization not found`)
      throw new AppError('unknown-error', err.message ?? `GitHub API error ${res.status}`)
    }
    const data = await res.json() as { full_name: string }
    logger.log(`github repo created: ${data.full_name}`)
    return data.full_name

  } else if (provider === 'gitlab') {
    const body: Record<string, unknown> = { name, initialize_with_readme: true }
    if (org) body.namespace_id = org
    const res = await fetch('https://gitlab.com/api/v4/projects', {
      method: 'POST',
      headers: {
        'PRIVATE-TOKEN': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const err = await res.json() as { message?: string | Record<string, string[]> }
      logger.log(`gitlab create failed status=${res.status} body=${JSON.stringify(err)}`)
      if (res.status === 400) {
        const msg = typeof err.message === 'object' ? JSON.stringify(err.message) : err.message ?? ''
        if (msg.toLowerCase().includes('taken') || msg.toLowerCase().includes('already')) {
          throw new AppError('repo-already-exists', 'Repository already exists')
        }
        throw new AppError('invalid-name', 'Invalid repository name')
      }
      if (res.status === 401 || res.status === 403) throw new AppError('auth-failed', 'Authentication failed')
      if (res.status === 404) throw new AppError('org-not-found', 'Group not found')
      throw new AppError('unknown-error', `GitLab API error ${res.status}`)
    }
    const data = await res.json() as { path_with_namespace: string }
    logger.log(`gitlab repo created: ${data.path_with_namespace}`)
    return data.path_with_namespace

  } else if (provider === 'bitbucket') {
    let workspace = org
    if (!workspace) {
      const meRes = await fetch('https://api.bitbucket.org/2.0/user', {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      if (!meRes.ok) throw new AppError('auth-failed', 'Authentication failed')
      const me = await meRes.json() as { username: string }
      workspace = me.username
    }

    const res = await fetch(`https://api.bitbucket.org/2.0/repositories/${workspace}/${name}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ scm: 'git', is_private: false }),
    })
    if (!res.ok) {
      const err = await res.json() as { error?: { message?: string } }
      logger.log(`bitbucket create failed status=${res.status} body=${JSON.stringify(err)}`)
      if (res.status === 400) throw new AppError('repo-already-exists', 'Repository already exists or name is invalid')
      if (res.status === 401 || res.status === 403) throw new AppError('auth-failed', 'Authentication failed')
      if (res.status === 404) throw new AppError('org-not-found', 'Workspace not found')
      throw new AppError('unknown-error', err.error?.message ?? `Bitbucket API error ${res.status}`)
    }
    const data = await res.json() as { full_name: string }
    logger.log(`bitbucket repo created: ${data.full_name}`)
    return data.full_name

  } else {
    throw new Error(`Unsupported provider: ${provider}`)
  }
}
