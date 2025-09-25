import { Link, useLocation } from "react-router-dom";
import SoundToggle from "./SoundToggle";

const tabs = [
    { to: "/", label: "Feed" },
    { to: "/upload", label: "Upload" },
    { to: "/inbox", label: "Inbox" },
    { to: "/profile", label: "Profile" },
];

export default function BottomTabBar() {
    const { pathname } = useLocation();
    return (
        <nav className="bottom-bar">
            {/* 4 tabs + sound */}
            <div className="bottom-grid">
                {tabs.map(t => (
                    <Link key={t.to} className={`tab ${pathname === t.to ? "active" : ""}`} to={t.to}>
                        {t.label}
                    </Link>
                ))}
                <div className="tab">
                    <SoundToggle compact />
                </div>
            </div>
        </nav>
    );
}
