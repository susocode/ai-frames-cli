/**
 * Normalize any repo reference to "owner/repo" format.
 * Handles:
 *   - owner/repo
 *   - https://github.com/owner/repo
 *   - https://github.com/owner/repo.git
 *   - git@github.com:owner/repo.git
 *   - repo (just the name — owner resolved from token identity)
 */
export function normalizeRepo(input: string): string {
  const s = input.trim().replace(/\.git$/, '')

  // SSH: git@github.com:owner/repo
  const ssh = s.match(/^git@[^:]+:(.+)$/)
  if (ssh) return ssh[1]

  // HTTPS: https://github.com/owner/repo
  try {
    const url = new URL(s)
    const parts = url.pathname.replace(/^\//, '').split('/').filter(Boolean)
    if (parts.length >= 2) return `${parts[0]}/${parts[1]}`
    if (parts.length === 1) return parts[0] // just repo name
  } catch {
    // not a URL
  }

  // Already owner/repo or just repo name
  return s
}
