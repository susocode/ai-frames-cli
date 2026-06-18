import { Router } from 'express'
import { getActiveContext } from '../services/config.js'
import { manifestExists, loadManifest, saveManifest } from '../services/manifest.js'
import { errorResponse, catchError } from '../utils/errors.js'

export const resourcesRouter = Router()

resourcesRouter.get('/', (_req, res) => {
  const context = getActiveContext()
  if (!context) {
    errorResponse(res, 'context-not-found', 404)
    return
  }
  try {
    if (!manifestExists(context.workspace)) {
      res.json({ manifest: null })
      return
    }
    res.json({ manifest: loadManifest(context.workspace) })
  } catch (err) {
    catchError(res, err)
  }
})

resourcesRouter.put('/', (req, res) => {
  const context = getActiveContext()
  if (!context) {
    errorResponse(res, 'context-not-found', 404)
    return
  }
  try {
    saveManifest(context.workspace, req.body)
    res.json({ ok: true })
  } catch (err) {
    catchError(res, err)
  }
})
