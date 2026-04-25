const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? process.env.GOLF_GAME_ADMIN_TOKEN ?? '';

const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

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
  if (!ADMIN_TOKEN) return true;

  if (readToken(req) !== ADMIN_TOKEN) {
    res.status(401).json({ error: 'Admin token required' });
    return false;
  }

  return true;
}
