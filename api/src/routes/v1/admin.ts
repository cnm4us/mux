import { Router } from 'express';
import { query } from '../../db/mysql.js';
import { hashPassword } from '../../auth/password.js';
import { requireRole } from '../../auth/session.js';

const r = Router();

// Guard: admin only for everything under /admin
r.use('/admin', requireRole('admin'));

// GET /api/v1/admin/roles
r.get('/admin/roles', async (req, res) => {
  const [rows] = await query<{ slug: string; name: string; id: number }>('SELECT id, slug, name FROM roles ORDER BY name');
  return res.json({ roles: rows });
});

// GET /api/v1/admin/users?search=&limit=&offset=
r.get('/admin/users', async (req, res) => {
  const search = String(req.query.search || '').trim();
  const limit = Math.min(Math.max(Number(req.query.limit ?? 50), 1), 200);
  const offset = Math.max(Number(req.query.offset ?? 0), 0);
  const params: any = { limit, offset };

  let where = '';
  if (search) {
    where = 'WHERE (u.email LIKE :q OR u.display_name LIKE :q)';
    params.q = `%${search}%`;
  }

  const sql = `
    SELECT u.id, u.email, u.display_name, u.status, u.last_login_at,
           GROUP_CONCAT(DISTINCT r.slug ORDER BY r.slug SEPARATOR ',') AS roles
    FROM users u
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles r ON r.id = ur.role_id
    ${where}
    GROUP BY u.id
    ORDER BY u.created_at DESC
    LIMIT :limit OFFSET :offset`;

  const [rows] = await query<any>(sql, params);
  const users = rows.map((r: any) => ({
    id: r.id,
    email: r.email,
    displayName: r.display_name,
    status: r.status,
    lastLoginAt: r.last_login_at,
    roles: r.roles ? String(r.roles).split(',').filter(Boolean) : [],
  }));
  return res.json({ users });
});

// POST /api/v1/admin/users
r.post('/admin/users', async (req, res) => {
  const { email, password, displayName, status, roles } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  const pwHash = await hashPassword(password);
  try {
    await query('INSERT INTO users (email, password_hash, status, display_name) VALUES (:email, :hash, :status, :dn)', {
      email,
      hash: pwHash,
      status: status === 'disabled' ? 'disabled' : 'active',
      dn: displayName ?? null,
    });
    const [[user]]: any = await query('SELECT id FROM users WHERE email = :email LIMIT 1', { email });
    if (user?.id) {
      // Resolve provided role slugs to ids
      const roleSlugs: string[] = Array.isArray(roles) ? roles : ['user'];
      if (roleSlugs.length) {
        const [rs] = await query<{ id: number }>(`SELECT id FROM roles WHERE slug IN (${roleSlugs.map((_, i) => `:s${i}`).join(',')})`, Object.fromEntries(roleSlugs.map((s, i) => [`s${i}`, s])));
        for (const r of rs) {
          await query('INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (:uid, :rid)', { uid: user.id, rid: r.id });
        }
      }
    }
    return res.status(201).json({ ok: true });
  } catch (e: any) {
    if (e?.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'email exists' });
    return res.status(500).json({ error: 'server_error' });
  }
});

// PUT /api/v1/admin/users/:id
r.put('/admin/users/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'bad_id' });
  const { displayName, status, roles, password } = req.body || {};

  // Update core fields
  const sets: string[] = [];
  const params: any = { id };
  if (displayName !== undefined) { sets.push('display_name = :dn'); params.dn = displayName ?? null; }
  if (status === 'active' || status === 'disabled') { sets.push('status = :st'); params.st = status; }
  if (password) { sets.push('password_hash = :ph'); params.ph = await hashPassword(password); }
  if (sets.length) {
    await query(`UPDATE users SET ${sets.join(', ')} WHERE id = :id`, params);
  }

  // Update roles if provided
  if (Array.isArray(roles)) {
    await query('DELETE FROM user_roles WHERE user_id = :id', { id });
    if (roles.length) {
      const [rs] = await query<{ id: number }>(`SELECT id FROM roles WHERE slug IN (${roles.map((_, i) => `:s${i}`).join(',')})`, Object.fromEntries(roles.map((s, i) => [`s${i}`, s])));
      for (const r of rs) {
        await query('INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (:uid, :rid)', { uid: id, rid: r.id });
      }
    }
  }

  return res.json({ ok: true });
});

export default r;

