import { NextRequest, NextResponse } from 'next/server'
import { loadContextWithToken, loadGlobalConfig, configExists } from '@/lib/services/config'
import { loadSelections, saveSelections, ResourceType } from '@/lib/services/selections'
import { listRepoItems, syncTypeToWorkspace } from '@/lib/services/marketplace'
import { catchJson, errorJson } from '@/lib/utils/api'
import { logger } from '@/lib/utils/logger'

async function getContext() {
  if (!configExists()) return null
  const global = loadGlobalConfig()
  return loadContextWithToken(global.active_context)
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params
  const context = await getContext()
  if (!context) return errorJson('context-not-found', 404)
  try {
    const available = listRepoItems(context.id, type as ResourceType)
    const selections = loadSelections(context.id)
    const selected = selections[type as ResourceType] ?? []
    return NextResponse.json({ type, available, selected: selected.filter(s => available.some(a => a.file === s)) })
  } catch (err) {
    return catchJson(err)
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params
  const context = await getContext()
  if (!context) return errorJson('context-not-found', 404)

  try {
    if (type === 'templates') {
      const { selected } = await request.json() as { selected: string[] }
      const available = listRepoItems(context.id, 'templates')
      const selections = loadSelections(context.id)
      const merged: Partial<Record<ResourceType, Set<string>>> = {}
      for (const file of selected) {
        const tmpl = available.find(a => a.file === file)
        if (!tmpl?.resources) continue
        for (const [rtype, items] of Object.entries(tmpl.resources)) {
          const t = rtype as ResourceType
          if (!merged[t]) merged[t] = new Set(selections[t] ?? [])
          for (const item of (items ?? [])) merged[t]!.add(item)
        }
      }
      for (const [rtype, itemSet] of Object.entries(merged)) {
        const t = rtype as ResourceType
        selections[t] = Array.from(itemSet)
        await syncTypeToWorkspace(context.id, context.workspace, t, selections[t]!)
      }
      selections['templates'] = selected
      saveSelections(context.id, selections)
      return NextResponse.json({ ok: true, installed: selected })
    } else {
      const { selected } = await request.json() as { selected: string[] }
      const selections = loadSelections(context.id)
      selections[type as ResourceType] = selected
      saveSelections(context.id, selections)
      await syncTypeToWorkspace(context.id, context.workspace, type as ResourceType, selected)
      return NextResponse.json({ ok: true, selected })
    }
  } catch (err) {
    return catchJson(err)
  }
}
