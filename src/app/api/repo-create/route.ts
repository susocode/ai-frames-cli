import { NextRequest, NextResponse } from 'next/server'
import { normalizeRepo } from '@/lib/utils/repo'
import { AppError, catchJson } from '@/lib/utils/api'
import { logger } from '@/lib/utils/logger'

export async function POST(request: NextRequest) {
  const { provider, name, auth } = await request.json()
  if (!provider || !name || !auth?.token) return NextResponse.json({ error: 'provider, name and auth.token are required' }, { status: 400 })
  try {
    const normalized = normalizeRepo(name)
    const parts = normalized.split('/')
    const repoName = parts[parts.length - 1]
    const org = parts.length >= 2 ? parts[0] : null
    const full_name = await createRepo(provider, repoName, auth.token, org ?? undefined)
    return NextResponse.json({ full_name })
  } catch (err) {
    return catchJson(err)
  }
}

async function createRepo(provider: string, name: string, token: string, org?: string): Promise<string> {
  if (provider === 'github') {
    const url = org ? `https://api.github.com/orgs/${org}/repos` : 'https://api.github.com/user/repos'
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'ai-frames' },
      body: JSON.stringify({ name, private: false, auto_init: true }),
    })
    if (!res.ok) {
      const err = await res.json() as { message?: string; errors?: { message?: string }[] }
      if (res.status === 422) {
        const detail = err.errors?.[0]?.message ?? err.message ?? ''
        if (detail.toLowerCase().includes('already exist')) throw new AppError('repo-already-exists', 'Already exists')
        throw new AppError('invalid-name', 'Invalid name')
      }
      if (res.status === 401 || res.status === 403) throw new AppError('auth-failed', 'Auth failed')
      if (res.status === 404) throw new AppError('org-not-found', 'Org not found')
      throw new AppError('unknown-error', err.message ?? `GitHub error ${res.status}`)
    }
    const data = await res.json() as { full_name: string }
    return data.full_name
  } else if (provider === 'gitlab') {
    const body: Record<string, unknown> = { name, initialize_with_readme: true }
    if (org) body.namespace_id = org
    const res = await fetch('https://gitlab.com/api/v4/projects', {
      method: 'POST',
      headers: { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const err = await res.json() as { message?: string | Record<string, string[]> }
      if (res.status === 400) throw new AppError('repo-already-exists', 'Already exists')
      if (res.status === 401 || res.status === 403) throw new AppError('auth-failed', 'Auth failed')
      throw new AppError('unknown-error', `GitLab error ${res.status}`)
    }
    const data = await res.json() as { path_with_namespace: string }
    return data.path_with_namespace
  } else {
    let workspace = org
    if (!workspace) {
      const meRes = await fetch('https://api.bitbucket.org/2.0/user', { headers: { 'Authorization': `Bearer ${token}` } })
      if (!meRes.ok) throw new AppError('auth-failed', 'Auth failed')
      const me = await meRes.json() as { username: string }
      workspace = me.username
    }
    const res = await fetch(`https://api.bitbucket.org/2.0/repositories/${workspace}/${name}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ scm: 'git', is_private: false }),
    })
    if (!res.ok) {
      if (res.status === 400) throw new AppError('repo-already-exists', 'Already exists')
      if (res.status === 401 || res.status === 403) throw new AppError('auth-failed', 'Auth failed')
      throw new AppError('unknown-error', `Bitbucket error ${res.status}`)
    }
    const data = await res.json() as { full_name: string }
    return data.full_name
  }
}
