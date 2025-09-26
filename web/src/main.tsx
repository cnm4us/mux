// web/src/main.tsx
import * as React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

// Register service worker for PWA
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("/sw.js").catch(() => { });
    });
}

createRoot(document.getElementById("root")!).render(<App />);
