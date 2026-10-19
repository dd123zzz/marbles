import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import './updatePrompt.css';

const READY_TOAST_MS = 4000;

/** Shown at the top of the screen so it never overlaps the toasts above the tab bar. */
export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW();

  useEffect(() => {
    if (!offlineReady) return;
    const id = window.setTimeout(() => setOfflineReady(false), READY_TOAST_MS);
    return () => window.clearTimeout(id);
  }, [offlineReady, setOfflineReady]);

  if (needRefresh) {
    return (
      <div role="status" aria-live="polite" className="update-banner">
        <span>A new version is available</span>
        <span className="update-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => updateServiceWorker(true)}
          >
            Reload
          </button>
          <button type="button" className="btn" onClick={() => setNeedRefresh(false)}>
            Later
          </button>
        </span>
      </div>
    );
  }

  if (offlineReady) {
    return (
      <div role="status" aria-live="polite" className="update-banner">
        <span>Ready to work offline</span>
      </div>
    );
  }

  return null;
}
