import * as React from 'react';
import { useAuth } from '@/context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

export default function RegisterPage() {
  const { register, loading } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [displayName, setDisplayName] = React.useState('');
  const [ok, setOk] = React.useState<boolean | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await register(email, password, displayName || undefined);
    setOk(success);
    if (success) nav('/login');
  };

  return (
    <div style={{ maxWidth: 420, margin: '40px auto', padding: 16 }}>
      <h2>Create Account</h2>
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 8 }}>
        <input type="text" placeholder="display name (optional)" value={displayName} onChange={e => setDisplayName(e.target.value)} />
        <input type="email" placeholder="email" value={email} onChange={e => setEmail(e.target.value)} required />
        <input type="password" placeholder="password" value={password} onChange={e => setPassword(e.target.value)} required />
        <button className="btn" disabled={loading} type="submit">{loading ? '...' : 'Register'}</button>
      </form>
      {ok === false && <div style={{ color: '#f87171', marginTop: 8 }}>Registration failed</div>}
      <div style={{ marginTop: 8 }}>
        <Link to="/login">Back to login</Link>
      </div>
    </div>
  );
}

