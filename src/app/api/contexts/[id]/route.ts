import { NextRequest, NextResponse } from 'next/server'
import { updateContext } from '@/lib/services/config'
import { errorJson, catchJson } from '@/lib/utils/api'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!id) return errorJson('invalid-input')
  try {
    const patch = await request.json()
    const updated = await updateContext(id, patch)
    return NextResponse.json({ ...updated, auth: { ...updated.auth, token: undefined } })
  } catch (err) {
    return catchJson(err)
  }
}
