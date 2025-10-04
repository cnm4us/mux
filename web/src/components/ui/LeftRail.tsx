import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

const items = [
    { to: "/", label: "Feed" },
    { to: "/upload", label: "Upload" },
    { to: "/inbox", label: "Inbox" },
    { to: "/profile", label: "Profile" },
    { to: "/settings", label: "Settings" },
    { to: "/logout", label: "Logout" },
];

export default function LeftRail() {
    const { pathname } = useLocation();
    const { roles } = useAuth();
    return (
        <aside className="left-rail">
            <nav className="left-rail-nav">
                {items.map(i => (
                    <Link key={i.to} className={`left-link ${pathname === i.to ? "active" : ""}`} to={i.to}>
                        {i.label}
                    </Link>
                ))}
                {roles.includes('admin') && (
                    <Link className={`left-link ${pathname === '/admin/users' ? 'active' : ''}`} to="/admin/users">
                        Admin · Users
                    </Link>
                )}
            </nav>
        </aside>
    );
}
