import * as React from 'react';
import { Protected, useAuth } from '@/context/AuthContext';
import { Link } from 'react-router-dom';

type Item = { id: string; title: string | null; status: string; createdAt: string; playbackId: string | null; duration: number | null };

async function j<T=any>(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(String(res.status));
  return res.json() as Promise<T>;
}

export default function MyUploadsPage() {
  const { user } = useAuth();
  const [items, setItems] = React.useState<Item[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let m = true;
    setLoading(true);
    j<{ items: Item[] }>(`/api/v1/me/videos?limit=100`).then(d => {
      if (!m) return;
      setItems(d.items);
      setError(null);
    }).catch(() => setError('load_failed')).finally(() => setLoading(false));
    return () => { m = false; };
  }, [user?.id]);

  async function onDelete(id: string) {
    const ok = window.confirm('Delete this video? This will remove it from feeds.');
    if (!ok) return;
    try {
      const res = await fetch(`/api/v1/me/videos/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(String(res.status));
      setItems(items => items.filter(it => it.id !== id));
    } catch {
      alert('Delete failed');
    }
  }

  return (
    <Protected>
      <div style={{ padding: 16 }}>
        <h2>My Uploads</h2>
        {loading && <div>Loading…</div>}
        {error && <div style={{ color: '#f87171' }}>Error loading uploads.</div>}
        {!loading && !error && (
          items.length === 0 ? (
            <div>No uploads yet.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Title</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map(it => (
                  <tr key={it.id}>
                    <td>{it.title ?? it.id}</td>
                    <td>{it.status}</td>
                    <td>{new Date(it.createdAt).toLocaleString()}</td>
                  <td style={{ display: 'flex', gap: 8 }}>
                    {it.playbackId ? (
                      <Link className="btn btn-compact" to={`/playback/${it.playbackId}`}>Play</Link>
                    ) : (
                      <span style={{ opacity: 0.6 }}>Processing…</span>
                    )}
                    <button className="btn btn-compact" onClick={() => onDelete(it.id)}>Delete</button>
                  </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>
    </Protected>
  );
}
