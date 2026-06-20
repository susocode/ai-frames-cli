import fs from 'fs'
import path from 'path'
import { parse, stringify } from 'yaml'

export interface RepoEntry {
  name: string
  source: string
  propagate_context: boolean
}

export interface PackageSelect {
  rules?: string[]
  agents?: string[]
  skills?: string[]
  prompts?: string[]
}

export interface PackageEntry {
  source: string
  select: PackageSelect
}

export interface Manifest {
  name: string
  version: string
  description?: string
  assistants: string[]
  resources?: { source: string; version: string }
  templates?: string[]
  repos: RepoEntry[]
  packages?: PackageEntry[]
}

export function manifestPath(workspacePath: string): string {
  return path.join(workspacePath, '.aicontext', 'manifest.yaml')
}

export function manifestExists(workspacePath: string): boolean {
  return fs.existsSync(manifestPath(workspacePath))
}

export function loadManifest(workspacePath: string): Manifest {
  const raw = fs.readFileSync(manifestPath(workspacePath), 'utf8')
  return parse(raw) as Manifest
}

export function saveManifest(workspacePath: string, manifest: Manifest): void {
  const dir = path.join(workspacePath, '.aicontext')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(manifestPath(workspacePath), stringify(manifest), 'utf8')
}

export function initManifest(workspacePath: string, name: string): Manifest {
  const manifest: Manifest = {
    name,
    version: '1.0.0',
    assistants: ['claude'],
    repos: [],
  }
  saveManifest(workspacePath, manifest)
  return manifest
}
