import jwt from 'jsonwebtoken';

// 密钥校验：生产环境必须显式设置 JWT_SECRET 且不能使用默认值，否则拒绝启动
const devFallback = 'development-only-change-me';
const raw = process.env.JWT_SECRET;
if (!raw || raw === devFallback) {
  if (process.env.NODE_ENV === 'production') {
    console.error('[security] 生产环境必须设置 JWT_SECRET 环境变量（且不能使用默认值），拒绝启动');
    process.exit(1);
  }
  console.warn('[security] 未设置 JWT_SECRET，开发环境使用临时默认值；生产环境将拒绝启动');
}
const secret = raw || devFallback;

export const tokenFor = user => jwt.sign({ sub: user.id, email: user.email }, secret, { expiresIn: '7d' });
export function requireUser(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: '需要登录' });
  try { req.user = jwt.verify(token, secret); next(); }
  catch { return res.status(401).json({ error: '登录已失效' }); }
}
