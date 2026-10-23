import { useState } from 'react';
import { createPortal } from 'react-dom';
import { CATEGORIES, CATEGORY_LABEL } from '../lib/jar';
import type { Category } from '../types';
import { useMarbleDrag, type DropInfo, type DropResult } from './useMarbleDrag';
import './tray.css';

export interface MarbleTrayProps {
  /** the window a drop logs, e.g. "13:30–14:30" or "yesterday 23:00–24:00" */
  rangeLabel: string;
  /** false while data is syncing: the tray is dimmed and a release writes nothing */
  writable: boolean;
  /**
   * Called when a marble is released clear of its home, or activated with Enter/Space.
   * Return `{ accepted: false }` to spring the marble back, or `flyTo` to aim the landing.
   */
  onDrop: (category: Category, info: DropInfo) => DropResult | void;
  /** The category the jar should glow for while a valid drag is in progress, else null. */
  onArmedChange?: (category: Category | null) => void;
  /** The jar's rect, measured when a drag starts. The overlay flies to its neck. */
  getDropTargetRect?: () => DOMRect | null;
}

export default function MarbleTray({
  rangeLabel,
  writable,
  onDrop,
  onArmedChange,
  getDropTargetRect,
}: MarbleTrayProps) {
  const [pulse, setPulse] = useState(0);
  const { active, overlayRef, bind } = useMarbleDrag({
    enabled: writable,
    onDrop,
    onArmedChange,
    getDropTargetRect,
    onTap: () => setPulse((n) => n + 1),
  });

  return (
    <div className="tray-wrap">
      <div
        className={`tray${writable ? '' : ' is-disabled'}`}
        role="group"
        aria-label="Marbles to log the last hour"
        aria-disabled={!writable || undefined}
      >
        {CATEGORIES.map((c) => (
          <div key={c} className="tray-item">
            <button
              type="button"
              className={`tray-marble${active === c ? ' is-lifted' : ''}`}
              aria-label={`Log ${rangeLabel} as ${CATEGORY_LABEL[c]}`}
              aria-disabled={!writable || undefined}
              {...bind(c)}
            >
              <span className={`tray-disc dot-${c}`} />
            </button>
            <span className="tray-caption" aria-hidden="true">
              {CATEGORY_LABEL[c]}
            </span>
          </div>
        ))}
      </div>
      <p className="tray-hint">
        <span key={pulse} className={pulse > 0 ? 'is-pulsing' : undefined}>
          {writable ? `Drag into the jar to log ${rangeLabel}` : 'Syncing…'}
        </span>
      </p>
      {active &&
        createPortal(
          <div ref={overlayRef} className="tray-overlay" aria-hidden="true">
            <span className={`tray-disc dot-${active}`} />
          </div>,
          document.body,
        )}
    </div>
  );
}
