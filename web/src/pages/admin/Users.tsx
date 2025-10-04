import * as React from 'react';

type Role = { id: number; slug: string; name: string };
type User = { id: number; email: string; displayName: string | null; status: 'active' | 'disabled'; lastLoginAt: string | null; roles: string[] };

async function j<T = any>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, { headers: { 'content-type': 'application/json' }, ...init });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

export default function AdminUsersPage() {
  const [users, setUsers] = React.useState<User[]>([]);
  const [roles, setRoles] = React.useState<Role[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [editing, setEditing] = React.useState<User | null>(null);
  const [creating, setCreating] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [u, r] = await Promise.all([
        j<{ users: User[] }>(`/api/v1/admin/users?search=${encodeURIComponent(search)}`),
        j<{ roles: Role[] }>(`/api/v1/admin/roles`),
      ]);
      setUsers(u.users);
      setRoles(r.roles);
    } finally {
      setLoading(false);
    }
  }, [search]);

  React.useEffect(() => { void load(); }, [load]);

  const onSaveEdit = async (form: { displayName?: string | null; status?: 'active'|'disabled'; roles?: string[]; password?: string }) => {
    if (!editing) return;
    await j(`/api/v1/admin/users/${editing.id}`, { method: 'PUT', body: JSON.stringify(form) });
    setEditing(null);
    await load();
  };

  const onCreate = async (form: { email: string; password: string; displayName?: string; status?: 'active'|'disabled'; roles?: string[] }) => {
    await j(`/api/v1/admin/users`, { method: 'POST', body: JSON.stringify(form) });
    setCreating(false);
    await load();
  };

  return (
      <div style={{ padding: 16 }}>
        <h2>Admin · Users</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search email or name" />
          <button className="btn" onClick={() => setCreating(true)}>Create User</button>
        </div>
        {loading ? (
          <div>Loading…</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Email</th>
                <th style={{ textAlign: 'left' }}>Name</th>
                <th>Status</th>
                <th>Roles</th>
                <th>Last Login</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>{u.email}</td>
                  <td>{u.displayName ?? '—'}</td>
                  <td>{u.status}</td>
                  <td>{u.roles.join(', ') || '—'}</td>
                  <td>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : '—'}</td>
                  <td><button className="btn btn-compact" onClick={() => setEditing(u)}>Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {editing && (
          <EditUserDialog user={editing} roles={roles} onClose={() => setEditing(null)} onSave={onSaveEdit} />
        )}
        {creating && (
          <CreateUserDialog roles={roles} onClose={() => setCreating(false)} onSave={onCreate} />
        )}
      </div>
  );
}

function EditUserDialog({ user, roles, onClose, onSave }: { user: User; roles: Role[]; onClose: () => void; onSave: (form: any) => void }) {
  const [displayName, setDisplayName] = React.useState(user.displayName ?? '');
  const [status, setStatus] = React.useState<User['status']>(user.status);
  const [selRoles, setSelRoles] = React.useState<string[]>(user.roles);
  const [password, setPassword] = React.useState('');

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div style={{ background: '#111', color: '#fff', padding: 16, maxWidth: 480, margin: '10vh auto' }} onClick={e => e.stopPropagation()}>
        <h3>Edit User</h3>
        <div>Email: {user.email}</div>
        <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
          <label>Name <input value={displayName} onChange={e => setDisplayName(e.target.value)} /></label>
          <label>Status {" "}
            <select value={status} onChange={e => setStatus(e.target.value as any)}>
              <option value="active">active</option>
              <option value="disabled">disabled</option>
            </select>
          </label>
          <fieldset style={{ border: '1px solid #333', padding: 8 }}>
            <legend>Roles</legend>
            {roles.map(r => (
              <label key={r.slug} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginRight: 12 }}>
                <input type="checkbox" checked={selRoles.includes(r.slug)} onChange={e => {
                  setSelRoles(v => e.target.checked ? Array.from(new Set([...v, r.slug])) : v.filter(s => s !== r.slug));
                }} />
                {r.slug}
              </label>
            ))}
          </fieldset>
          <label>Reset Password <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="leave blank to keep" /></label>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={() => onSave({ displayName, status, roles: selRoles, ...(password ? { password } : {}) })}>Save</button>
        </div>
      </div>
    </div>
  );
}

function CreateUserDialog({ roles, onClose, onSave }: { roles: Role[]; onClose: () => void; onSave: (form: any) => void }) {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [displayName, setDisplayName] = React.useState('');
  const [status, setStatus] = React.useState<'active'|'disabled'>('active');
  const [selRoles, setSelRoles] = React.useState<string[]>(['user']);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div style={{ background: '#111', color: '#fff', padding: 16, maxWidth: 480, margin: '10vh auto' }} onClick={e => e.stopPropagation()}>
        <h3>Create User</h3>
        <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
          <label>Email <input value={email} onChange={e => setEmail(e.target.value)} /></label>
          <label>Password <input type="password" value={password} onChange={e => setPassword(e.target.value)} /></label>
          <label>Name <input value={displayName} onChange={e => setDisplayName(e.target.value)} /></label>
          <label>Status {" "}
            <select value={status} onChange={e => setStatus(e.target.value as any)}>
              <option value="active">active</option>
              <option value="disabled">disabled</option>
            </select>
          </label>
          <fieldset style={{ border: '1px solid #333', padding: 8 }}>
            <legend>Roles</legend>
            {roles.map(r => (
              <label key={r.slug} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginRight: 12 }}>
                <input type="checkbox" checked={selRoles.includes(r.slug)} onChange={e => {
                  setSelRoles(v => e.target.checked ? Array.from(new Set([...v, r.slug])) : v.filter(s => s !== r.slug));
                }} />
                {r.slug}
              </label>
            ))}
          </fieldset>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={() => onSave({ email, password, displayName, status, roles: selRoles })}>Create</button>
        </div>
      </div>
    </div>
  );
}
