import express from 'express'
import https from 'https'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import open from 'open'
import { repairConfig } from './services/config.js'
import { contextsRouter } from './routes/contexts.js'
import { resourcesRouter } from './routes/resources.js'
import { installRouter } from './routes/install.js'
import { verifyRouter } from './routes/verify.js'
import { repoCreateRouter } from './routes/repo-create.js'
import { workspaceCheckRouter } from './routes/workspace-check.js'
import { workspaceDirsRouter } from './routes/workspace-dirs.js'
import { assistantInitRouter } from './routes/assistant-init.js'
import { customDirsRouter } from './routes/custom-dirs.js'
import { repoSyncRouter } from './routes/repo-sync.js'
import { repoInitRouter } from './routes/repo-init.js'
import { repoStatusRouter } from './routes/repo-status.js'
import { logger } from './utils/logger.js'
import { getCert } from './utils/tls.js'
import { checkDependencies } from './utils/check-deps.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3141

export async function startServer() {
  repairConfig()
  const app = express()

  app.use(express.json())

  // Request logging in debug mode
  app.use((req, _res, next) => {
    logger.log(`${req.method} ${req.path}`, req.body && Object.keys(req.body).length ? req.body : '')
    next()
  })

  // API routes
  app.use('/api/contexts', contextsRouter)
  app.use('/api/resources', resourcesRouter)
  app.use('/api/install', installRouter)
  app.use('/api/verify', verifyRouter)
  app.use('/api/repo-create', repoCreateRouter)
  app.use('/api/workspace-check', workspaceCheckRouter)
  app.use('/api/workspace-dirs', workspaceDirsRouter)
  app.use('/api/repo-status', repoStatusRouter)
  app.use('/api/repo-init', repoInitRouter)
  app.use('/api/repo-sync', repoSyncRouter)
  app.use('/api/custom-dirs', customDirsRouter)
  app.use('/api/assistant-init', assistantInitRouter)

  // Serve React UI (built artifacts) — skipped in dev if dist doesn't exist
  const uiDist = path.resolve(__dirname, '../../ui/dist')
  const uiIndex = path.join(uiDist, 'index.html')
  if (fs.existsSync(uiIndex)) {
    app.use(express.static(uiDist))
    app.get('*', (_req, res) => res.sendFile(uiIndex))
  }

  const isDev = !fs.existsSync(uiIndex)

  if (!isDev) checkDependencies()

  if (isDev) {
    // Dev mode — plain HTTP, Vite handles the UI on its own port
    app.listen(PORT, () => {
      const url = `http://localhost:${PORT}`
      logger.info(`ai-frames API running at ${url} (dev mode, no TLS)`)
      if (logger.debug) logger.info('debug mode enabled')
    })
  } else {
    // Production — HTTPS with trusted localhost cert via devcert
    const { cert, key } = await getCert()
    const server = https.createServer({ cert, key }, app)
    server.listen(PORT, () => {
      const url = `https://localhost:${PORT}`
      logger.info(`ai-frames running at ${url}`)
      if (logger.debug) logger.info('debug mode enabled')
      open(url)
    })
  }
}
