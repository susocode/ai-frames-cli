import keytar from 'keytar'
import { logger } from '../utils/logger.js'

const SERVICE = 'ai-frames'

export async function saveToken(contextId: string, token: string): Promise<void> {
  await keytar.setPassword(SERVICE, contextId, token)
  logger.log(`keychain: saved token for context ${contextId}`)
}

export async function getToken(contextId: string): Promise<string | null> {
  const token = await keytar.getPassword(SERVICE, contextId)
  logger.log(`keychain: retrieved token for context ${contextId}: ${token ? 'found' : 'not found'}`)
  return token
}

export async function deleteToken(contextId: string): Promise<void> {
  await keytar.deletePassword(SERVICE, contextId)
  logger.log(`keychain: deleted token for context ${contextId}`)
}
