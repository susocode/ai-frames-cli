import fs from 'fs'
import path from 'path'
import os from 'os'
import { parse, stringify } from 'yaml'

const CONTEXTS_DIR = path.join(os.homedir(), '.ai-frames', 'contexts')

export interface AssistantConfig {
  id: string
  label: string
  prefix: string
  enabled: boolean
}

export const DEFAULT_ASSISTANTS: AssistantConfig[] = [
  { id: 'claude',   label: 'Claude Code',    prefix: '.claude',   enabled: false },
  { id: 'copilot',  label: 'GitHub Copilot', prefix: '.copilot',  enabled: false },
  { id: 'cursor',   label: 'Cursor',         prefix: '.cursor',   enabled: false },
  { id: 'windsurf', label: 'Windsurf',       prefix: '.windsurf', enabled: false },
]

function assistantsFile(contextId: string): string {
  return path.join(CONTEXTS_DIR, contextId, 'assistants.yaml')
}

export function loadAssistants(contextId: string): AssistantConfig[] {
  const f = assistantsFile(contextId)
  if (!fs.existsSync(f)) return DEFAULT_ASSISTANTS.map(a => ({ ...a }))
  return parse(fs.readFileSync(f, 'utf8')) as AssistantConfig[]
}

export function saveAssistants(contextId: string, assistants: AssistantConfig[]): void {
  fs.writeFileSync(assistantsFile(contextId), stringify(assistants), 'utf8')
}
