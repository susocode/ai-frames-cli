import { NextResponse } from 'next/server'
import { loadContextWithToken, loadGlobalConfig, configExists } from '@/lib/services/config'
import { catchJson, errorJson } from '@/lib/utils/api'
import { logger } from '@/lib/utils/logger'

export async function GET() {
  if (!configExists()) return errorJson('context-not-found', 404)
  try {
    const global = loadGlobalConfig()
    const context = await loadContextWithToken(global.active_context)
    const initialized = await checkAicontextExists(context.provider, context.resources_repo, context.auth?.token)
    return NextResponse.json({ empty: !initialized, repo: context.resources_repo })
  } catch (err) {
    return catchJson(err)
  }
}

async function checkAicontextExists(provider: string, repo: string, token?: string): Promise<boolean> {
  const headers: Record<string, string> = { 'User-Agent': 'ai-frames' }
  let url: string
  if (provider === 'github') {
    url = `https://api.github.com/repos/${repo}/contents/.aicontext`
    if (token) headers['Authorization'] = `Bearer ${token}`
  } else if (provider === 'gitlab') {
    url = `https://gitlab.com/api/v4/projects/${encodeURIComponent(repo)}/repository/tree?path=.aicontext`
    if (token) headers['PRIVATE-TOKEN'] = token
  } else {
    url = `https://api.bitbucket.org/2.0/repositories/${repo}/src/HEAD/.aicontext/`
    if (token) headers['Authorization'] = `Bearer ${token}`
  }
  const response = await fetch(url, { headers })
  return response.ok
}
