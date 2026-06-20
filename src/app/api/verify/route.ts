import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { normalizeRepo } from '@/lib/utils/repo'
import { AppError, catchJson, errorJson } from '@/lib/utils/api'
import { logger } from '@/lib/utils/logger'

const execAsync = promisify(exec)

export async function POST(request: NextRequest) {
  const { provider, resources_repo, auth } = await request.json()
  if (!provider || !resources_repo) return NextResponse.json({ error: 'provider and resources_repo are required' }, { status: 400 })

  try {
    const repo = normalizeRepo(resources_repo)
    let exists: boolean
    if (auth?.token) {
      exists = await checkRepoHttp(provider, repo, auth.token)
    } else if (auth?.type === 'ssh' && auth.key_path) {
      exists = await checkRepoSsh(provider, repo, auth.key_path)
    } else {
      exists = await checkRepoHttp(provider, repo, undefined)
    }
    return NextResponse.json({ exists, repo })
  } catch (err) {
    return catchJson(err)
  }
}

async function checkRepoHttp(provider: string, repo: string, token?: string): Promise<boolean> {
  const headers: Record<string, string> = { 'User-Agent': 'ai-frames' }
  let url: string
  if (provider === 'github') {
    url = `https://api.github.com/repos/${repo}`
    if (token) headers['Authorization'] = `Bearer ${token}`
  } else if (provider === 'gitlab') {
    url = `https://gitlab.com/api/v4/projects/${encodeURIComponent(repo)}`
    if (token) headers['PRIVATE-TOKEN'] = token
  } else {
    url = `https://api.bitbucket.org/2.0/repositories/${repo}`
    if (token) headers['Authorization'] = `Bearer ${token}`
  }
  const response = await fetch(url, { headers })
  if (response.status === 404) return false
  if (response.status === 401 || response.status === 403) throw new AppError('auth-failed', 'Authentication failed')
  return response.ok
}

async function checkRepoSsh(provider: string, repo: string, keyPath: string): Promise<boolean> {
  const hosts: Record<string, string> = { github: 'github.com', gitlab: 'gitlab.com', bitbucket: 'bitbucket.org' }
  const sshUrl = `git@${hosts[provider]}:${repo}.git`
  const resolvedKey = keyPath.replace(/^~/, process.env.HOME ?? '')
  try {
    await execAsync(`GIT_SSH_COMMAND="ssh -i ${resolvedKey} -o StrictHostKeyChecking=no -o BatchMode=yes" git ls-remote "${sshUrl}"`, { timeout: 10000 })
    return true
  } catch (e: any) {
    const stderr: string = e.stderr ?? ''
    if (stderr.includes('not found') || stderr.includes('does not exist') || stderr.includes('Repository not found')) return false
    if (stderr.includes('Permission denied') || stderr.includes('publickey')) throw new AppError('verify-ssh-failed', 'SSH auth failed')
    throw new AppError('verify-connection-failed', `git ls-remote failed: ${stderr.trim()}`)
  }
}
