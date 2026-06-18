import { Router } from 'express'
import { exec } from 'child_process'
import { promisify } from 'util'
import { logger } from '../utils/logger.js'
import { normalizeRepo } from '../utils/repo.js'
import { AppError, catchError } from '../utils/errors.js'
import { getToken } from '../services/keychain.js'

const execAsync = promisify(exec)

export const verifyRouter = Router()

interface VerifyBody {
  provider: 'github' | 'gitlab' | 'bitbucket'
  resources_repo: string
  auth?: { type: string; token?: string; key_path?: string }
}

verifyRouter.post('/', async (req, res) => {
  const { provider, resources_repo, auth } = req.body as VerifyBody

  if (!provider || !resources_repo) {
    res.status(400).json({ error: 'provider and resources_repo are required' })
    return
  }

  try {
    const repo = normalizeRepo(resources_repo)
    logger.log(`verify repo="${repo}" (raw="${resources_repo}") provider="${provider}" auth="${auth?.type ?? 'none'}"`)
    let exists: boolean
    if (auth?.token) {
      logger.log(`verify strategy: token`)
      exists = await checkRepoHttp(provider, repo, auth.token)
    } else if (auth?.type === 'ssh' && auth.key_path) {
      logger.log(`verify strategy: ssh`)
      exists = await checkRepoSsh(provider, repo, auth.key_path)
    } else {
      logger.log(`verify strategy: public`)
      exists = await checkRepoHttp(provider, repo, undefined)
    }
    logger.log(`verify result exists=${exists} repo="${repo}"`)
    res.json({ exists, repo })
  } catch (err) {
    logger.log(`verify failed: ${err instanceof Error ? err.message : String(err)}`)
    catchError(res, err)
  }
})

async function checkRepoHttp(
  provider: string,
  repo: string,
  token?: string
): Promise<boolean> {
  const headers: Record<string, string> = { 'User-Agent': 'ai-frames' }
  let url: string

  if (provider === 'github') {
    url = `https://api.github.com/repos/${repo}`
    if (token) headers['Authorization'] = `Bearer ${token}`
  } else if (provider === 'gitlab') {
    const encoded = encodeURIComponent(repo)
    url = `https://gitlab.com/api/v4/projects/${encoded}`
    if (token) headers['PRIVATE-TOKEN'] = token
  } else if (provider === 'bitbucket') {
    url = `https://api.bitbucket.org/2.0/repositories/${repo}`
    if (token) headers['Authorization'] = `Bearer ${token}`
  } else {
    throw new Error(`Unknown provider: ${provider}`)
  }

  logger.log(`http check url="${url}"`)
  const response = await fetch(url, { headers })
  logger.log(`http response status=${response.status}`)
  if (response.status === 404) return false
  if (response.status === 401 || response.status === 403) {
    throw new AppError('auth-failed', 'Authentication failed')
  }
  return response.ok
}

async function checkRepoSsh(
  provider: string,
  repo: string,
  keyPath: string
): Promise<boolean> {
  const hosts: Record<string, string> = {
    github: 'github.com',
    gitlab: 'gitlab.com',
    bitbucket: 'bitbucket.org',
  }
  const host = hosts[provider]
  const sshUrl = `git@${host}:${repo}.git`
  const resolvedKey = keyPath.replace(/^~/, process.env.HOME ?? '')

  logger.log(`ssh check url="${sshUrl}" key="${resolvedKey}"`)

  try {
    // Use ls-remote without --exit-code: exit 0 = repo accessible (even if empty)
    const { stdout, stderr } = await execAsync(
      `GIT_SSH_COMMAND="ssh -i ${resolvedKey} -o StrictHostKeyChecking=no -o BatchMode=yes" git ls-remote "${sshUrl}"`,
      { timeout: 10000 }
    )
    logger.log(`ssh ok stdout="${stdout.trim()}" stderr="${stderr.trim()}"`)
    return true
  } catch (e: any) {
    const stderr: string = e.stderr ?? ''
    logger.log(`ssh failed code=${e.code} stderr="${stderr.trim()}"`)

    // Repo does not exist
    if (
      stderr.includes('not found') ||
      stderr.includes('does not exist') ||
      stderr.includes('Repository not found') ||
      stderr.includes('ERROR: Repository not found')
    ) {
      return false
    }

    // Auth / key issues
    if (
      stderr.includes('Permission denied') ||
      stderr.includes('publickey') ||
      stderr.includes('authentication failed') ||
      stderr.includes('could not read Username')
    ) {
      throw new AppError('verify-ssh-failed', 'SSH authentication failed')
    }

    throw new AppError('verify-connection-failed', `git ls-remote failed (code ${e.code}): ${stderr.trim() || 'no output'}`)
  }
}
