export type ErrorCode =
  // Auth
  | 'auth-failed'
  | 'no-token'
  // Repository
  | 'repo-already-exists'
  | 'repo-not-found'
  | 'repo-invalid-name'
  | 'invalid-name'
  | 'org-not-found'
  // Verify
  | 'verify-ssh-failed'
  | 'verify-connection-failed'
  // Context
  | 'context-not-found'
  | 'context-already-exists'
  | 'context-invalid'
  // Install
  | 'install-clone-failed'
  | 'install-workspace-missing'
  // Generic
  | 'invalid-input'
  | 'unknown-error'

export class AppError extends Error {
  constructor(public code: ErrorCode, message: string) {
    super(message)
    this.name = 'AppError'
  }
}

export function errorResponse(res: any, code: ErrorCode, status = 400): void {
  res.status(status).json({ code })
}

export function catchError(res: any, err: unknown): void {
  if (err instanceof AppError) {
    res.status(400).json({ code: err.code })
  } else {
    const message = err instanceof Error ? err.message : String(err)
    res.status(500).json({ code: 'unknown-error', detail: message })
  }
}
