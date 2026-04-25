const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? process.env.GOLF_GAME_ADMIN_TOKEN ?? '';

const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

function isLocalDev() {
  return process.env.NODE_ENV !== 'production' && !process.env.VERCEL_ENV;
}

function readToken(req) {
  const headerToken = req.headers['x-admin-token'];
  if (Array.isArray(headerToken)) return headerToken[0] ?? '';
  if (headerToken) return headerToken;

  const auth = req.headers.authorization ?? '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? '';
}

export function requireAdmin(req, res) {
  if (!MUTATING_METHODS.has(req.method)) return true;

  if (!ADMIN_TOKEN) {
    if (isLocalDev()) {
      console.warn('ADMIN_TOKEN is not set; allowing mutation in local development.');
      return true;
    }
    res.status(500).json({ error: 'Admin protection is not configured' });
    return false;
  }

  if (readToken(req) !== ADMIN_TOKEN) {
    res.status(401).json({ error: 'Admin token required' });
    return false;
  }

  return true;
}
