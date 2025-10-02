import * as React from 'react';
import { useAuth } from '@/context/AuthContext';
import { Navigate } from 'react-router-dom';

export default function LogoutPage() {
  const { logout } = useAuth();
  const [done, setDone] = React.useState(false);
  React.useEffect(() => { (async () => { await logout(); setDone(true); })(); }, [logout]);
  if (done) return <Navigate to="/login" replace />;
  return <div style={{ padding: 16 }}>Logging out…</div>;
}

