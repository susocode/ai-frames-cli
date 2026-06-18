import { Router } from 'express'
import { loadContextWithToken, loadGlobalConfig, configExists } from '../services/config.js'
import { install } from '../services/installer.js'
import { errorResponse, catchError } from '../utils/errors.js'

export const installRouter = Router()

// POST /api/install — run install for the active context
installRouter.post('/', async (_req, res) => {
  try {
    if (!configExists()) {
      errorResponse(res, 'context-not-found', 404)
      return
    }
    const global = loadGlobalConfig()
    if (!global?.active_context) {
      errorResponse(res, 'context-not-found', 404)
      return
    }
    const context = await loadContextWithToken(global.active_context)
    await install(context)
    res.json({ ok: true })
  } catch (err) {
    catchError(res, err)
  }
})
