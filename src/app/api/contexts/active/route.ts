import { NextRequest, NextResponse } from 'next/server'
import { setActiveContext } from '@/lib/services/config'
import { errorJson } from '@/lib/utils/api'

export async function PUT(request: NextRequest) {
  const { id } = await request.json() as { id: string }
  if (!id) return errorJson('invalid-input')
  setActiveContext(id)
  return NextResponse.json({ ok: true })
}
