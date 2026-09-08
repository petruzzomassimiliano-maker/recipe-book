/**
 * Global error handler for Hono app.
 * Catches unhandled errors and returns consistent JSON.
 */
export const errorHandler = (err, c) => {
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
