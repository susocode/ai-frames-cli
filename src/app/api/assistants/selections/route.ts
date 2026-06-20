import { NextResponse } from 'next/server'
import { getActiveContext } from '@/lib/services/config'
import { loadAssistants } from '@/lib/services/assistants'
import { loadSelections } from '@/lib/services/selections'
import { errorJson } from '@/lib/utils/api'

export async function GET() {
  const context = getActiveContext()
  if (!context) return errorJson('context-not-found', 404)
  const selections = loadSelections(context.id)
  const assistants = loadAssistants(context.id)
  const result: Record<string, boolean> = {}
  for (const a of assistants) {
    result[a.id] = Object.values(selections).some(
      (items: unknown) => Array.isArray(items) && (items as string[]).some(s => s.startsWith(a.prefix + '/'))
    )
  }
  return NextResponse.json({ selections: result })
}
