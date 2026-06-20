export const logger = {
  debug: process.env.AIFRAME_DEBUG === '1',

  info(msg: string, ...args: unknown[]) {
    console.log(`[info]  ${msg}`, ...args)
  },

  error(msg: string, ...args: unknown[]) {
    console.error(`[error] ${msg}`, ...args)
  },

  log(msg: string, ...args: unknown[]) {
    if (!this.debug) return
    console.log(`[debug] ${msg}`, ...args)
  },
}
