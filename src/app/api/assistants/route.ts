import { NextRequest, NextResponse } from 'next/server'
import { getActiveContext } from '@/lib/services/config'
import { loadAssistants, saveAssistants, AssistantConfig } from '@/lib/services/assistants'
import { catchJson, errorJson } from '@/lib/utils/api'

export async function GET() {
  const context = getActiveContext()
  if (!context) return errorJson('context-not-found', 404)
  return NextResponse.json({ assistants: loadAssistants(context.id) })
}

export async function PUT(request: NextRequest) {
  const context = getActiveContext()
  if (!context) return errorJson('context-not-found', 404)
  try {
    const assistants = await request.json() as AssistantConfig[]
    saveAssistants(context.id, assistants)
    return NextResponse.json({ assistants })
  } catch (err) { return catchJson(err) }
}

export async function POST(request: NextRequest) {
  const context = getActiveContext()
  if (!context) return errorJson('context-not-found', 404)
  try {
    const { id, label, prefix } = await request.json() as { id: string; label: string; prefix: string }
    if (!id || !label || !prefix) return errorJson('invalid-input')
    const current = loadAssistants(context.id)
    if (current.find(a => a.id === id)) return errorJson('context-already-exists')
    const updated = [...current, { id, label, prefix, enabled: false }]
    saveAssistants(context.id, updated)
    return NextResponse.json({ assistants: updated }, { status: 201 })
  } catch (err) { return catchJson(err) }
}
