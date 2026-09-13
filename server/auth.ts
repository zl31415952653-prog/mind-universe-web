import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';

export interface AuthUser {
  sub: string;
  email: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

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

export const tokenFor = (user: { id: string; email: string }): string =>
  jwt.sign({ sub: user.id, email: user.email }, secret, { expiresIn: '7d' });

export function requireUser(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) {
    res.status(401).json({ error: '需要登录' });
    return;
  }
  try {
    const payload = jwt.verify(token, secret) as jwt.JwtPayload;
    req.user = { sub: String(payload.sub), email: String(payload.email) };
    next();
  } catch {
    res.status(401).json({ error: '登录已失效' });
  }
}
