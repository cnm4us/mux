import { Link, useLocation } from "react-router-dom";
import SoundToggle from "./SoundToggle";

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
    return (
        <aside className="left-rail">
            <SoundToggle />
            <nav className="left-rail-nav">
                {items.map(i => (
                    <Link key={i.to} className={`left-link ${pathname === i.to ? "active" : ""}`} to={i.to}>
                        {i.label}
                    </Link>
                ))}
            </nav>
        </aside>
    );
}
