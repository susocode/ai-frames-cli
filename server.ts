import http from 'http'
import { createRequire } from 'module'
import { dirname } from 'path'
import { fileURLToPath } from 'url'
import open from 'open'

const require = createRequire(import.meta.url)
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3141

export async function startServer(opts: { dev?: boolean; debug?: boolean } = {}) {
  const isDev = opts.dev ?? process.env.NODE_ENV !== 'production'

  // dir must be the package root so Next.js finds .next/ when globally installed
  const dir = dirname(fileURLToPath(import.meta.url))
  const next = require('next') as (opts: { dev: boolean; dir: string }) => { getRequestHandler: () => (req: any, res: any) => void; prepare: () => Promise<void> }
  const app = next({ dev: isDev, dir })
  const handle = app.getRequestHandler()

  await app.prepare()

  const server = http.createServer((req, res) => handle(req, res))
  server.listen(PORT, () => {
    const url = `http://localhost:${PORT}`
    console.log(`ai-frames running at ${url}`)
    if (!isDev) open(url)
  })
}
