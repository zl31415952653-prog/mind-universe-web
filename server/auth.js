import jwt from 'jsonwebtoken';

const secret = process.env.JWT_SECRET || 'development-only-change-me';
export const tokenFor = user => jwt.sign({ sub: user.id, email: user.email }, secret, { expiresIn: '7d' });
export function requireUser(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: '需要登录' });
  try { req.user = jwt.verify(token, secret); next(); }
  catch { return res.status(401).json({ error: '登录已失效' }); }
}
