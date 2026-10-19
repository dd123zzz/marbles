import { useEffect, type CSSProperties } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const READY_TOAST_MS = 4000;

const bannerStyle: CSSProperties = {
  position: 'fixed',
  left: 12,
  right: 12,
  bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  maxWidth: 480,
  margin: '0 auto',
  padding: '10px 14px',
  borderRadius: 10,
  background: '#111827',
  color: '#ffffff',
  fontSize: 14,
  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
};

const buttonStyle: CSSProperties = {
  font: 'inherit',
  padding: '6px 12px',
  borderRadius: 8,
  border: '1px solid #ffffff55',
  background: 'transparent',
  color: 'inherit',
  cursor: 'pointer',
};

const primaryButtonStyle: CSSProperties = {
  ...buttonStyle,
  background: '#4f46e5',
  borderColor: '#4f46e5',
};

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
      <div role="status" aria-live="polite" style={bannerStyle}>
        <span>A new version is available</span>
        <span style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            style={primaryButtonStyle}
            onClick={() => updateServiceWorker(true)}
          >
            Reload
          </button>
          <button type="button" style={buttonStyle} onClick={() => setNeedRefresh(false)}>
            Later
          </button>
        </span>
      </div>
    );
  }

  if (offlineReady) {
    return (
      <div role="status" aria-live="polite" style={bannerStyle}>
        <span>Ready to work offline</span>
      </div>
    );
  }

  return null;
}
