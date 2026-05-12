/**
 * Wraps a Vercel serverless handler with uniform error handling.
 * Catches unhandled exceptions and returns a consistent 500 shape
 * without leaking stack traces to the client.
 *
 * Usage:
 *   export default withHandler(async (req, res) => { ... });
 */
export function withHandler(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      console.error('Unhandled handler error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  };
}

/**
 * Parses a query/body value as a positive integer.
 * Returns the integer on success, or null if invalid.
 */
export function parseIntParam(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

const VALID_STATUSES = new Set(['upcoming', 'in', 'post']);

/**
 * Returns true if value is a valid tournament status string.
 */
export function isValidStatus(value) {
  return VALID_STATUSES.has(value);
}
