import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

export default function MenuDrawer() {
  const [open, setOpen] = React.useState(false);
  const { user, roles } = useAuth();
  const nav = useNavigate();

  const close = () => setOpen(false);

  return (
    <>
      {/* Hamburger button */}
      <button
        aria-label={open ? 'Close menu' : 'Open menu'}
        className={`hamburger-btn ${open ? 'is-open' : ''}`}
        onClick={() => setOpen(!open)}
      >
        <span className="bar" />
        <span className="bar" />
        <span className="bar" />
      </button>

      {/* Transparent backdrop to capture clicks (no dimming) */}
      {open && <div className="drawer-backdrop" onClick={close} />}

      {/* Drawer */}
      <aside className={`drawer ${open ? 'open' : ''}`} role="menu" aria-label="Main menu">
        <nav className="drawer-nav">
          {/* First item: Login/Logout depending on state */}
          {user ? (
            <Link to="/logout" className="drawer-link" onClick={close}>Logout</Link>
          ) : (
            <Link to="/login" className="drawer-cta" onClick={close}>Login</Link>
          )}

          {/* Additional common links */}
          <Link to="/" className="drawer-link" onClick={close}>Feed</Link>
          <Link to="/upload" className="drawer-link" onClick={close}>Upload</Link>
          <Link to="/inbox" className="drawer-link" onClick={close}>Inbox</Link>
          <Link to="/profile" className="drawer-link" onClick={close}>Profile</Link>
          <Link to="/settings" className="drawer-link" onClick={close}>Settings</Link>
          {roles.includes('admin') && (
            <Link to="/admin/users" className="drawer-link" onClick={close}>Admin · Users</Link>
          )}
        </nav>
      </aside>
    </>
  );
}
