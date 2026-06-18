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

  { path: '.aicontext/contexts/.gitkeep', content: '' },
  { path: '.aicontext/templates/.gitkeep', content: '' },
  { path: '.aicontext/README.md', content: `# AI Context

This repository is managed by [ai-frames](https://ai-frames.org) and contains the shared AI context for all repositories in your workspace.

Every folder here is synced to your local \`.aicontext/\` directory. When you run **Install**, ai-frames transforms these files into the native format expected by each AI assistant (Claude Code, GitHub Copilot, Cursor, Windsurf).

---

## Structure

### \`rules/\`
Mandatory instructions always injected into the AI context. Use this for coding conventions, API design standards, quality rules, security guidelines — anything the assistant must always follow.

- Files in \`rules/\` apply to **all assistants**.
- Files in \`rules/.claude/\` apply **only to Claude Code**.
- Files in \`rules/.copilot/\` apply **only to GitHub Copilot**.

### \`agents/\`
Specialized AI subagent definitions. Each file defines a subagent with a specific role, instructions and optionally restricted tool access.

- Files in \`agents/\` are available to **all assistants** that support subagents.
- Files in \`agents/.claude/\` are **Claude Code** specific agent definitions.

### \`skills/\`
Reusable slash commands that extend what the AI assistant can do. Each skill is a \`.md\` file with a prompt template invoked via a slash command.

- Files in \`skills/\` are shared across assistants.
- Files in \`skills/.claude/\` are only available in Claude Code.

### \`prompts/\`
Reusable prompt templates for common tasks — code review, refactoring, documentation, test generation, etc.

- Files in \`prompts/\` are shared.
- Files in \`prompts/.claude/\` become **Claude Code commands** (\`.claude/commands/\`).
- Files in \`prompts/.copilot/\` become **Copilot prompt files** (\`.github/prompts/\`).

### \`mcps/\`
MCP (Model Context Protocol) server configurations. Each file defines an MCP server that gives the AI assistant access to external tools, APIs or data sources.

### \`contexts/\`
Project-level context documentation, organized by organization and repository:

\`\`\`
contexts/
  <org>/
    <repo>/
      CONTEXT.md   — shared context for all assistants
      CLAUDE.md    — Claude Code specific context (merged with CONTEXT.md on install)
      AGENTS.md    — Copilot/agents specific context (merged with CONTEXT.md on install)
\`\`\`

Use this to document architecture decisions, project conventions, important patterns and anything the AI should know before working on a specific repository.

---

## How it works

1. Edit files in this repo.
2. Open ai-frames and press **Sync** — changes are pulled to your local \`.aicontext/\`.
3. Press **Install** — ai-frames distributes the right files to each AI assistant's native directory.
` },
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
