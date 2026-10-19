import type { DeviceTilt } from '../hooks/useDeviceTilt';
import type { JarStyle } from '../types';

function LooseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
      <circle cx="8" cy="16.5" r="4" fill="currentColor" />
      <circle cx="16.5" cy="16.5" r="4" fill="currentColor" opacity="0.7" />
      <circle cx="12.2" cy="8.5" r="4" fill="currentColor" opacity="0.45" />
    </svg>
  );
}

export function JarStyleToggle({
  style,
  onChange,
}: {
  style: JarStyle;
  onChange: (style: JarStyle) => void;
}) {
  const loose = style === 'loose';
  return (
    <button
      type="button"
      className={`icon-btn jar-toggle${loose ? ' jar-toggle-on' : ''}`}
      aria-label="Loose jar"
      aria-pressed={loose}
      title={loose ? 'Switch to the grid jar' : 'Switch to the loose jar'}
      onClick={() => onChange(loose ? 'grid' : 'loose')}
    >
      <LooseIcon />
    </button>
  );
}

export function TiltToggle({ tilt, onDenied }: { tilt: DeviceTilt; onDenied?: () => void }) {
  if (tilt.enabled) {
    return (
      <button
        type="button"
        className="btn jar-tilt jar-tilt-on"
        aria-pressed="true"
        onClick={tilt.disable}
      >
        Tilt on
      </button>
    );
  }
  return (
    <button
      type="button"
      className="btn jar-tilt"
      onClick={() => {
        void tilt.enable().then((ok) => {
          if (!ok) onDenied?.();
        });
      }}
    >
      Enable tilt
    </button>
  );
}
