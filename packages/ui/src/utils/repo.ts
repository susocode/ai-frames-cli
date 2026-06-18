/**
 * Validates that a repo input matches one of the accepted formats:
 * - owner/repo
 * - https://github.com/owner/repo(.git)
 * - git@github.com:owner/repo(.git)
 */
export function isValidRepoFormat(value: string): boolean {
  if (!value.trim()) return false
  const s = value.trim()

  // SSH: git@host:owner/repo(.git)
  if (/^git@[^:]+:.+\/.+/.test(s)) return true

  // HTTPS URL: https://host/owner/repo
  try {
    const url = new URL(s)
    const parts = url.pathname.replace(/^\//, '').replace(/\.git$/, '').split('/').filter(Boolean)
    if (parts.length >= 2) return true
  } catch { /* not a URL */ }

  // owner/repo (plain)
  if (/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(s.replace(/\.git$/, ''))) return true

  return false
}

/**
 * Validates repo name for creation: repo-name or org/repo-name
 */
export function isValidCreateName(value: string): boolean {
  if (!value.trim()) return false
  const s = value.trim()
  // org/repo-name or just repo-name — only letters, numbers, hyphens, underscores
  return /^([a-zA-Z0-9_-]+\/)?[a-zA-Z0-9_.-]+$/.test(s)
}
