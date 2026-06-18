import { Router } from 'express'
import { loadContextWithToken, loadGlobalConfig, configExists } from '../services/config.js'
import { logger } from '../utils/logger.js'
import { catchError, errorResponse } from '../utils/errors.js'

export const repoStatusRouter = Router()

// GET /api/repo-status — check if the resources repo has content
repoStatusRouter.get('/', async (_req, res) => {
  if (!configExists()) {
    errorResponse(res, 'context-not-found', 404)
    return
  }
  try {
    const global = loadGlobalConfig()
    const context = await loadContextWithToken(global.active_context)
    const { provider, resources_repo, auth } = context

    const isEmpty = await checkRepoEmpty(provider, resources_repo, auth?.token)
    res.json({ empty: isEmpty, repo: resources_repo })
  } catch (err) {
    logger.log(`repo-status failed: ${err instanceof Error ? err.message : String(err)}`)
    catchError(res, err)
  }
})

async function checkRepoEmpty(
  provider: string,
  repo: string,
  token?: string
): Promise<boolean> {
  const headers: Record<string, string> = { 'User-Agent': 'ai-frames' }
  let url: string

  if (provider === 'github') {
    url = `https://api.github.com/repos/${repo}/contents/`
    if (token) headers['Authorization'] = `Bearer ${token}`
  } else if (provider === 'gitlab') {
    const encoded = encodeURIComponent(repo)
    url = `https://gitlab.com/api/v4/projects/${encoded}/repository/tree`
    if (token) headers['PRIVATE-TOKEN'] = token
  } else if (provider === 'bitbucket') {
    url = `https://api.bitbucket.org/2.0/repositories/${repo}/src/`
    if (token) headers['Authorization'] = `Bearer ${token}`
  } else {
    return false
  }

  const response = await fetch(url, { headers })

  if (!response.ok) {
    // 404 on contents = empty repo (no commits yet)
    if (response.status === 404) return true
    return false
  }

  const data = await response.json() as unknown[]
  // GitHub returns [] for empty repos, GitLab returns [] too
  return Array.isArray(data) && data.length === 0
}
