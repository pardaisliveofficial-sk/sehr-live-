import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Intercept and handle Firestore quota/resource-exhausted errors cleanly to prevent developer log pollution
if (typeof window !== "undefined") {
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;

  console.error = function (...args: any[]) {
    const msg = args.map(arg => {
      if (arg instanceof Error) {
        return `${arg.message} ${arg.stack || ""}`;
      }
      return String(arg || "");
    }).join(" ").toLowerCase();

    if (
      msg.includes("firestore") && 
      (msg.includes("resource_exhausted") || msg.includes("quota") || msg.includes("resource-exhausted") || msg.includes("code: 8") || msg.includes("code=resource-exhausted"))
    ) {
      // Gracefully log as a warning/info in development rather than a system-critical error
      originalConsoleWarn.apply(console, [
        "[Sahr Live - Firebase Status] Firestore quota reached. Sahr Live is running securely with local fallback cache.",
        ...args
      ]);
      return;
    }
    originalConsoleError.apply(console, args);
  };

  // Prevent background unhandled rejections for Firestore streams from crashing the UI
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const msg = String(reason?.message || reason || "").toLowerCase();
    if (
      msg.includes("firestore") && 
      (msg.includes("resource_exhausted") || msg.includes("quota") || msg.includes("resource-exhausted") || msg.includes("code: 8") || msg.includes("code=resource-exhausted"))
    ) {
      originalConsoleWarn.apply(console, [
        "[Sahr Live - Firebase Status] Silenced background Firestore unhandled rejection due to exhausted write quota.",
        reason
      ]);
      event.preventDefault();
    }
  });

  // Catch generic window errors related to the Firestore client stream connection
  const originalOnError = window.onerror;
  window.onerror = function (message, source, lineno, colno, error) {
    const msg = String(message || "").toLowerCase();
    if (
      msg.includes("firestore") && 
      (msg.includes("resource_exhausted") || msg.includes("quota") || msg.includes("resource-exhausted") || msg.includes("code: 8") || msg.includes("code=resource-exhausted"))
    ) {
      originalConsoleWarn.apply(console, [
        "[Sahr Live - Firebase Status] Silenced window error due to Firestore exhausted write quota."
      ]);
      return true; // prevent error firing
    }
    if (originalOnError) {
      return originalOnError.apply(this, arguments as any);
    }
    return false;
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
