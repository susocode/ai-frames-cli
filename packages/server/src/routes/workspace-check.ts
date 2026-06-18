import { Router } from 'express'
import fs from 'fs'
import os from 'os'
import { logger } from '../utils/logger.js'

export const workspaceCheckRouter = Router()

workspaceCheckRouter.post('/', (req, res) => {
  const { path: rawPath } = req.body as { path: string }
  if (!rawPath?.trim()) {
    res.status(400).json({ exists: false })
    return
  }
  const resolved = rawPath.trim().replace(/^~/, os.homedir())
  logger.log(`workspace-check path="${resolved}"`)
  const exists = fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()
  res.json({ exists })
})
