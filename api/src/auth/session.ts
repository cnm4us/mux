import crypto from 'node:crypto';
import type { Response, Request, NextFunction } from 'express';
import { query } from '../db/mysql.js';
import { config } from '../config/index.js';

export type SessionRow = {
  id: number;
  session_id: string;
  user_id: number;
  created_at: Date;
  last_seen_at: Date;
  expires_at: Date;
  revoked_at: Date | null;
};

export type UserRow = {
  id: number;
  email: string;
  password_hash: string;
  status: 'active' | 'disabled';
  display_name: string | null;
};

export async function createSession(userId: number, req: Request, res: Response) {
  const sid = crypto.randomBytes(32).toString('base64url');
  const now = new Date();
  const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
  const ip = req.ip || '';
  const ua = String(req.headers['user-agent'] || '').slice(0, 512);
  await query(
    'INSERT INTO sessions (session_id, user_id, created_at, last_seen_at, expires_at, ip, user_agent) VALUES (:sid, :uid, NOW(), NOW(), :exp, INET6_ATON(:ip), :ua)',
    { sid, uid: userId, exp: expires, ip, ua }
  );
  setSessionCookie(res, sid, expires);
}

export function setSessionCookie(res: Response, sid: string, expires: Date) {
  const isProd = config.NODE_ENV === 'production';
  res.cookie('sid', sid, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    expires,
    path: '/',
  });
}

export async function revokeSession(sid: string) {
  await query('UPDATE sessions SET revoked_at = NOW() WHERE session_id = :sid', { sid });
}

export async function getUserByEmail(email: string): Promise<UserRow | null> {
  const [rows] = await query<UserRow>('SELECT * FROM users WHERE email = :email LIMIT 1', { email });
  return rows[0] ?? null;
}

export async function getUserById(id: number): Promise<UserRow | null> {
  const [rows] = await query<UserRow>('SELECT * FROM users WHERE id = :id LIMIT 1', { id });
  return rows[0] ?? null;
}

export async function getUserRoles(userId: number): Promise<string[]> {
  const [rows] = await query<{ slug: string }>(
    `SELECT r.slug FROM roles r
     JOIN user_roles ur ON ur.role_id = r.id
     WHERE ur.user_id = :uid`,
    { uid: userId }
  );
  return rows.map(r => r.slug);
}

export async function findSession(sid: string): Promise<SessionRow | null> {
  const [rows] = await query<SessionRow>(
    'SELECT * FROM sessions WHERE session_id = :sid AND (revoked_at IS NULL) AND (expires_at > NOW()) LIMIT 1',
    { sid }
  );
  return rows[0] ?? null;
}

export async function touchSession(sid: string) {
  await query('UPDATE sessions SET last_seen_at = NOW() WHERE session_id = :sid', { sid });
}

export async function authMiddleware(req: Request & { user?: any; roles?: string[] }, res: Response, next: NextFunction) {
  try {
    const sid = (req as any).cookies?.sid || req.cookies?.sid;
    if (!sid) return next();
    const s = await findSession(sid);
    if (!s) return next();
    const user = await getUserById(s.user_id);
    if (!user || user.status !== 'active') return next();
    req.user = { id: user.id, email: user.email, displayName: user.display_name };
    req.roles = await getUserRoles(user.id);
    await touchSession(sid);
    return next();
  } catch (e) {
    return next();
  }
}

export function requireAuth(req: Request & { user?: any }, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'unauthorized' });
  return next();
}

export function requireRole(role: string) {
  return (req: Request & { roles?: string[] }, res: Response, next: NextFunction) => {
    if (!req.roles || !req.roles.includes(role)) return res.status(403).json({ error: 'forbidden' });
    return next();
  };
}
