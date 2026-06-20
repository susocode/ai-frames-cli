import { NextResponse } from 'next/server'
import { AppError, ErrorCode } from './errors'

export { AppError }

export function errorJson(code: ErrorCode, status = 400): NextResponse {
  return NextResponse.json({ code }, { status })
}

export function catchJson(err: unknown): NextResponse {
  if (err instanceof AppError) {
    return NextResponse.json({ code: err.code }, { status: 400 })
  }
  const message = err instanceof Error ? err.message : String(err)
  return NextResponse.json({ code: 'unknown-error', detail: message }, { status: 500 })
}
