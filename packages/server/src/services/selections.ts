import fs from 'fs'
import path from 'path'
import os from 'os'
import { parse, stringify } from 'yaml'

const CONFIG_DIR = path.join(os.homedir(), '.ai-frames')
const CONTEXTS_DIR = path.join(CONFIG_DIR, 'contexts')

export type ResourceType = 'rules' | 'agents' | 'skills' | 'prompts' | 'mcps' | 'contexts' | 'templates'

export type Selections = Partial<Record<ResourceType, string[]>>

function selectionsFile(contextId: string): string {
  return path.join(CONTEXTS_DIR, contextId, 'selections.yaml')
}

export function loadSelections(contextId: string): Selections {
  const f = selectionsFile(contextId)
  if (!fs.existsSync(f)) return {}
  return parse(fs.readFileSync(f, 'utf8')) as Selections ?? {}
}

export function saveSelections(contextId: string, selections: Selections): void {
  fs.writeFileSync(selectionsFile(contextId), stringify(selections), 'utf8')
}

export function addSelection(contextId: string, type: ResourceType, item: string): void {
  const sel = loadSelections(contextId)
  const list = sel[type] ?? []
  if (!list.includes(item)) {
    sel[type] = [...list, item]
    saveSelections(contextId, sel)
  }
}

export function removeSelection(contextId: string, type: ResourceType, item: string): void {
  const sel = loadSelections(contextId)
  sel[type] = (sel[type] ?? []).filter(i => i !== item)
  saveSelections(contextId, sel)
}
