import { Router } from 'express'
import { loadContextWithToken, loadGlobalConfig, configExists } from '../services/config.js'
import { logger } from '../utils/logger.js'
import { catchError, errorResponse } from '../utils/errors.js'

export const repoStatusRouter = Router()

// GET /api/repo-status — check if the resources repo has .aicontext/ initialized
repoStatusRouter.get('/', async (_req, res) => {
  if (!configExists()) {
    errorResponse(res, 'context-not-found', 404)
    return
  }
  try {
    const global = loadGlobalConfig()
    const context = await loadContextWithToken(global.active_context)
    const { provider, resources_repo, auth } = context

    const initialized = await checkAicontextExists(provider, resources_repo, auth?.token)
    res.json({ empty: !initialized, repo: resources_repo })
  } catch (err) {
    logger.log(`repo-status failed: ${err instanceof Error ? err.message : String(err)}`)
    catchError(res, err)
  }
})

// Returns true if .aicontext/ directory exists in the repo
async function checkAicontextExists(
  provider: string,
  repo: string,
  token?: string
): Promise<boolean> {
  const headers: Record<string, string> = { 'User-Agent': 'ai-frames' }
  let url: string

  if (provider === 'github') {
    url = `https://api.github.com/repos/${repo}/contents/.aicontext`
    if (token) headers['Authorization'] = `Bearer ${token}`
  } else if (provider === 'gitlab') {
    const encoded = encodeURIComponent(repo)
    url = `https://gitlab.com/api/v4/projects/${encoded}/repository/tree?path=.aicontext`
    if (token) headers['PRIVATE-TOKEN'] = token
  } else if (provider === 'bitbucket') {
    url = `https://api.bitbucket.org/2.0/repositories/${repo}/src/HEAD/.aicontext/`
    if (token) headers['Authorization'] = `Bearer ${token}`
  } else {
    return false
  }

  const response = await fetch(url, { headers })
  logger.log(`repo-status: check .aicontext/ → ${response.status}`)

  // 200 = .aicontext/ exists, 404 = not initialized yet
  return response.ok
}
