export function isAbsolutePath(value: string): boolean {
  if (!value.trim()) return true // empty — don't warn yet
  return (
    /^\//.test(value) ||        // Unix: /home/user
    /^~\//.test(value) ||       // Unix home shorthand: ~/projects
    /^~$/.test(value) ||        // just ~
    /^[a-zA-Z]:[/\\]/.test(value) // Windows: C:\ or C:/
  )
}
