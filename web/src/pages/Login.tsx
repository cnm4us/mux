import * as React from 'react';
import { useAuth } from '@/context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

export default function LoginPage() {
  const { login, loading, user } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => { if (user) nav('/'); }, [user, nav]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null);
    const ok = await login(email, password);
    if (!ok) setErr('Invalid email or password');
    else nav('/');
  };

  return (
    <div style={{ maxWidth: 420, margin: '40px auto', padding: 16 }}>
      <h2>Login</h2>
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 8 }}>
        <input type="email" placeholder="email" value={email} onChange={e => setEmail(e.target.value)} required />
        <input type="password" placeholder="password" value={password} onChange={e => setPassword(e.target.value)} required />
        <button className="btn" disabled={loading} type="submit">{loading ? '...' : 'Login'}</button>
      </form>
      {err && <div style={{ color: '#f87171', marginTop: 8 }}>{err}</div>}
      <div style={{ marginTop: 8 }}>
        <Link to="/register">Create account</Link>
      </div>
    </div>
  );
}

