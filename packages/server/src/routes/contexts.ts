import { Router } from 'express'
import { catchError, errorResponse } from '../utils/errors.js'
import { logger } from '../utils/logger.js'
import {
  configExists,
  listContexts,
  addContext,
  getActiveContext,
  setActiveContext,
  updateContext,
  Context,
} from '../services/config.js'


export const contextsRouter = Router()

// GET /api/contexts — list all contexts + whether setup is needed
contextsRouter.get('/', (_req, res) => {
  try {
    const setup_required = !configExists()
    if (setup_required) {
      res.json({ setup_required: true, active: null, contexts: [] })
      return
    }
    const contexts = listContexts()
    const active = getActiveContext()
    // Sanitize tokens before sending to UI
    const sanitize = (c: Context | null) => c ? { ...c, auth: { ...c.auth, token: undefined } } : null
    res.json({
      setup_required: false,
      active: sanitize(active),
      contexts: contexts.map(c => sanitize(c)!),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(`GET /api/contexts failed: ${message}`)
    // Return a non-setup-required error so the UI doesn't redirect to setup
    res.status(500).json({ setup_required: false, active: null, contexts: [], code: 'unknown-error' })
  }
})

// POST /api/contexts — create a new context (used in onboarding and later)
contextsRouter.post('/', async (req, res) => {
  const body = req.body as Omit<Context, 'id'>
  if (!body.name || !body.workspace || !body.resources_repo) {
    errorResponse(res, 'invalid-input')
    return
  }
  const created = await addContext(body)
  res.status(201).json({ ...created, auth: { ...created.auth, token: undefined } })
})

// PUT /api/contexts/active — switch active context by id (must be before /:id)
contextsRouter.put('/active', (req, res) => {
  const { id } = req.body as { id: string }
  if (!id) {
    errorResponse(res, 'invalid-input')
    return
  }
  setActiveContext(id)
  res.json({ active: id })
})

// PUT /api/contexts/:id — update a context
contextsRouter.put('/:id', async (req, res) => {
  const { id } = req.params
  try {
    const updated = await updateContext(id, req.body)
    res.json({ ...updated, auth: { ...updated.auth, token: undefined } })
  } catch (err) {
    catchError(res, err)
  }
})
