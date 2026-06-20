import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import os from 'os'

export async function POST(request: NextRequest) {
  const { path: rawPath } = await request.json() as { path: string }
  if (!rawPath?.trim()) return NextResponse.json({ exists: false }, { status: 400 })
  const resolved = rawPath.trim().replace(/^~/, os.homedir())
  const exists = fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()
  return NextResponse.json({ exists })
}
