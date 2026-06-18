import fs from 'fs'
import path from 'path'
import { simpleGit } from 'simple-git'
import { loadManifest } from './manifest.js'
import { Context } from './config.js'

const CLAUDE_SUBDIRS = ['agents', 'rules', 'commands', 'skills']

export async function install(context: Context): Promise<void> {
  const { workspace } = context
  const manifest = loadManifest(workspace)

  const runtimeRoot = path.join(workspace, 'runtimes', 'root')
  const reposDir = path.join(runtimeRoot, 'repos')
  const claudeDir = path.join(runtimeRoot, '.claude')
  const aicontextDir = path.join(workspace, '.aicontext')
  const mcpFile = path.join(runtimeRoot, '.mcp.json')

  // Ensure base dirs exist
  for (const dir of [reposDir, claudeDir, aicontextDir]) {
    fs.mkdirSync(dir, { recursive: true })
  }
  for (const sub of CLAUDE_SUBDIRS) {
    fs.mkdirSync(path.join(claudeDir, sub), { recursive: true })
  }

  // Ensure .mcp.json exists
  if (!fs.existsSync(mcpFile)) {
    fs.writeFileSync(mcpFile, JSON.stringify({ mcpServers: {} }, null, 2))
  }

  // Write AGENTS.md at runtime root
  const agentsMd = path.join(runtimeRoot, 'AGENTS.md')
  if (!fs.existsSync(agentsMd)) {
    fs.writeFileSync(agentsMd, agentsMdContent(manifest.name))
  }

  // Clone repos and create symlinks
  for (const repo of manifest.repos) {
    await setupRepo(repo.name, repo.source, reposDir, runtimeRoot, context)
  }
}

async function setupRepo(
  name: string,
  source: string,
  reposDir: string,
  runtimeRoot: string,
  context: Context
): Promise<void> {
  const repoPath = path.join(reposDir, name)

  if (!fs.existsSync(repoPath)) {
    console.log(`Cloning ${name}...`)
    const git = simpleGit()
    const cloneUrl = injectAuth(source, context)
    await git.clone(cloneUrl, repoPath)
  }

  // .claude/* → symlinks to ../../../.claude/*
  const claudeDir = path.join(repoPath, '.claude')
  fs.mkdirSync(claudeDir, { recursive: true })
  for (const sub of CLAUDE_SUBDIRS) {
    const link = path.join(claudeDir, sub)
    const target = path.join('..', '..', '..', '.claude', sub)
    createSymlink(target, link)
  }

  // .aicontext → symlink to ../../.aicontext
  createSymlink(
    path.join('..', '..', '.aicontext'),
    path.join(repoPath, '.aicontext')
  )

  // .mcp.json → symlink to ../../.mcp.json
  createSymlink(
    path.join('..', '..', '.mcp.json'),
    path.join(repoPath, '.mcp.json')
  )
}

function createSymlink(target: string, linkPath: string): void {
  if (fs.existsSync(linkPath) || fs.lstatSync(linkPath).isSymbolicLink()) {
    fs.unlinkSync(linkPath)
  }
  fs.symlinkSync(target, linkPath)
}

function injectAuth(source: string, context: Context): string {
  if (context.auth.type === 'none' || !context.auth.token) return source
  try {
    const url = new URL(source)
    url.username = context.auth.token
    return url.toString()
  } catch {
    return source
  }
}

function agentsMdContent(name: string): string {
  return `# ${name}

This is an ai-frames runtime workspace.

- \`.aicontext/\` — resolved configuration (rules, skills, agents, MCPs, prompts)
- \`.aicontext/deliverables/\` — shared folder for AI assistants to exchange artifacts between sessions
- \`repos/\` — code repositories, each with symlinked context from this root
`
}
