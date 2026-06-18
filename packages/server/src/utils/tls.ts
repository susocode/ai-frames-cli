import { createRequire } from 'module'
import { logger } from './logger.js'

const require = createRequire(import.meta.url)

export interface TlsCert {
  cert: Buffer | string
  key: Buffer | string
}

export async function getCert(): Promise<TlsCert> {
  logger.log('tls: obtaining certificate via devcert')
  const devcert = require('devcert')
  const { cert, key } = await devcert.certificateFor('localhost')
  logger.log('tls: certificate ready')
  return { cert, key }
}
