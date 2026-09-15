/**
 * Global error handler for Hono app.
 * Catches unhandled errors and returns consistent JSON.
 */
export const errorHandler = (err, c) => {
  if (err.code === 'DROPBOX_TOKEN_EXPIRED' || err.message === 'DROPBOX_TOKEN_EXPIRED') {
    return c.json({ error: 'Dropbox token expired', code: 'DROPBOX_TOKEN_EXPIRED' }, 401)
  }
  console.error('[errorHandler]', err.message, err.stack)
  return c.json(
    {
      error: 'Internal server error',
      message: err.message,
      ...(c.env.ENVIRONMENT === 'development' ? { stack: err.stack } : {})
    },
    500
  )
}
