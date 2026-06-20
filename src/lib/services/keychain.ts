import fs from 'fs'
import path from 'path'
import os from 'os'

function tokenFile(contextId: string): string {
  return path.join(os.homedir(), '.ai-frames', 'contexts', contextId, '.token')
}

export async function saveToken(contextId: string, token: string): Promise<void> {
  const file = tokenFile(contextId)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, token, { encoding: 'utf8', mode: 0o600 })
}

export async function getToken(contextId: string): Promise<string | null> {
  const file = tokenFile(contextId)
  if (!fs.existsSync(file)) return null
  return fs.readFileSync(file, 'utf8').trim() || null
}

export async function deleteToken(contextId: string): Promise<void> {
  const file = tokenFile(contextId)
  if (fs.existsSync(file)) fs.rmSync(file)
}
