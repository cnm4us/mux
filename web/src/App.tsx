import { useEffect, useMemo, useState } from "react";
import { BrowserRouter, Routes, Route, useParams, useLocation, Navigate } from "react-router-dom";
import MuxPlayer from "@mux/mux-player-react";
import Player from "@/components/Player";

import Feed from "@/components/Feed";
import Uploader from "@/components/Uploader";

// If you used the alias setup I provided, these live at:
//   web/src/components/ui/BottomTabBar.tsx
//   web/src/components/ui/LeftRail.tsx
import BottomTabBar from "@/components/ui/BottomTabBar";
import LeftRail from "@/components/ui/LeftRail";
import MenuDrawer from "@/components/ui/MenuDrawer";

import "./styles.css";
import { AuthProvider } from "@/context/AuthContext";
import LoginPage from "@/pages/Login";
import RegisterPage from "@/pages/Register";
import LogoutPage from "@/pages/Logout";
import AdminUsersPage from "@/pages/admin/Users";
import { RequireRole } from "@/context/AuthContext";

const API = import.meta.env.VITE_API_BASE_URL ?? "/api";

/** Standalone single-player page used by:
 *   1) /playback/:pb
 *   2) fallback when query ?pb=... is present (handled in <AppShell/>)
 */
function SinglePlayerPage({ pbOverride }: { pbOverride?: string }) {
    const { pb: pbFromRoute } = useParams();
    const pb = pbOverride || pbFromRoute;
    const [src, setSrc] = useState<string | null>(null);

    useEffect(() => {
        if (!pb) return;
        (async () => {
            const r = await fetch(`${API}/playback/${pb}/play`);
            const j = await r.json();
            setSrc(j?.playback?.url ?? null);
        })();
    }, [pb]);

    if (!pb) return <Navigate to="/" replace />;
    if (!src) return <p style={{ padding: 16 }}>Loading…</p>;

    return (
        <div style={{ maxWidth: 420, margin: "40px auto" }}>
            <h1>Mux POC</h1>
            <small style={{ wordBreak: "break-all" }}>{src}</small>
            <Player
                src={src}
                streamType="on-demand"
                autoPlay
                muted
                playsInline
                style={{ width: "100%", aspectRatio: "9 / 16", display: "block", marginTop: 12 }}
            />
        </div>
    );
}

/** App chrome: left rail on md+; bottom tab bar on mobile.
 *  Also honors legacy ?pb=... to open the single-player view.
 */
function AppShell() {
    const { search } = useLocation();
    const pb = useMemo(() => new URLSearchParams(search).get("pb") ?? undefined, [search]);

    // Legacy query support: if ?pb exists, render single-player view
    if (pb) {
        return <SinglePlayerPage pbOverride={pb} />;
    }

    return (
        <>
            <MenuDrawer />
            <LeftRail />
            <main className="app-main">
                <Routes>
                    <Route path="/" element={<Feed />} />
                    <Route path="/upload" element={<Uploader />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />
                    <Route path="/logout" element={<LogoutPage />} />
                    <Route path="/admin/users" element={<RequireRole role="admin"><AdminUsersPage /></RequireRole>} />
                    <Route path="/inbox" element={<div style={{ padding: 16 }}>Inbox (coming soon)</div>} />
                    <Route path="/profile" element={<div style={{ padding: 16 }}>Profile (coming soon)</div>} />
                    <Route path="/settings" element={<div style={{ padding: 16 }}>Settings (coming soon)</div>} />
                    <Route path="/playback/:pb" element={<SinglePlayerPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </main>
            <BottomTabBar />
        </>
    );
}

export default function App() {
    const base = (import.meta as any).env.BASE_URL || "/";
    return (
        <BrowserRouter basename={base}>
            <AuthProvider>
                <AppShell />
            </AuthProvider>
        </BrowserRouter>
    );
}
