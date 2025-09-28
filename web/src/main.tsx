// web/src/main.tsx
import * as React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

// Register service worker for PWA
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("/sw.js").catch(() => { });
    });

    // Listen for SW messages about version updates
    navigator.serviceWorker.addEventListener("message", (ev: MessageEvent) => {
        const data: any = ev.data;
        if (!data) return;
        if (data.type === "NEW_VERSION_AVAILABLE") {
            // Simple UX: prompt to refresh; in a media app you may prefer a non-blocking toast
            const ok = window.confirm("A new version is available. Refresh now?");
            if (ok) window.location.reload();
        }
    });

    // Ask SW to check for updates when the page becomes visible
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
            navigator.serviceWorker.controller?.postMessage({ type: "CHECK_VERSION" });
        }
    });
}

createRoot(document.getElementById("root")!).render(<App />);
