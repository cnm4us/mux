import { Router } from 'express';
import { query } from '../../db/mysql.js';
import { hashPassword, verifyPassword } from '../../auth/password.js';
import { createSession, revokeSession } from '../../auth/session.js';

const r = Router();

// Register (dev convenience; no email verification yet)
r.post('/auth/register', async (req, res) => {
  try {
    const { email, password, displayName } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    const pwHash = await hashPassword(password);
    await query(
      'INSERT INTO users (email, password_hash, status, display_name) VALUES (:email, :hash, "active", :displayName)',
      { email, hash: pwHash, displayName: displayName ?? null }
    );
    // Assign default role 'user' if exists
    const [[role]]: any = await query('SELECT id FROM roles WHERE slug = "user" LIMIT 1');
    const [[user]]: any = await query('SELECT id FROM users WHERE email = :email LIMIT 1', { email });
    if (role && user) {
      await query('INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (:uid, :rid)', { uid: user.id, rid: role.id });
    }
    return res.status(201).json({ ok: true });
  } catch (e: any) {
    if (e?.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'email exists' });
    return res.status(500).json({ error: 'server_error' });
  }
});

// Login
r.post('/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  const [[user]]: any = await query('SELECT * FROM users WHERE email = :email LIMIT 1', { email });
  if (!user || user.status !== 'active') return res.status(401).json({ error: 'invalid_credentials' });
  const ok = await verifyPassword(user.password_hash, password);
  if (!ok) return res.status(401).json({ error: 'invalid_credentials' });
  await createSession(user.id, req, res);
  await query('UPDATE users SET last_login_at = NOW() WHERE id = :id', { id: user.id });
  return res.json({ ok: true });
});

// Logout
r.post('/auth/logout', async (req: any, res) => {
  const sid = req.cookies?.sid;
  if (sid) await revokeSession(sid);
  res.clearCookie('sid', { path: '/' });
  return res.json({ ok: true });
});

// Me
r.get('/auth/me', async (req: any, res) => {
  if (!req.user) return res.status(200).json({ user: null, roles: [] });
  return res.json({ user: req.user, roles: req.roles || [] });
});

export default r;

