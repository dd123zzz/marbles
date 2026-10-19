import { useCallback, useSyncExternalStore } from 'react';
import type { JarStyle } from '../types';

export const JAR_STYLE_KEY = 'marbles-jar-style';
const CHANGE_EVENT = 'marbles:jar-style';
const DEFAULT_STYLE: JarStyle = 'grid';

// Used only when localStorage refuses the write, so this tab still follows the choice.
let override: JarStyle | null = null;

function isJarStyle(v: unknown): v is JarStyle {
  return v === 'grid' || v === 'loose';
}

function read(): JarStyle {
  if (override) return override;
  try {
    const v = localStorage.getItem(JAR_STYLE_KEY);
    return isJarStyle(v) ? v : DEFAULT_STYLE;
  } catch {
    return DEFAULT_STYLE;
  }
}

function subscribe(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    // a null key means the whole storage was cleared
    if (e.key === null || e.key === JAR_STYLE_KEY) {
      override = null;
      onChange();
    }
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/** The jar style of this device: saved in localStorage and shared by every user of the hook. */
export function useJarStyle(): [JarStyle, (style: JarStyle) => void] {
  const style = useSyncExternalStore(subscribe, read, () => DEFAULT_STYLE);
  const setStyle = useCallback((next: JarStyle) => {
    try {
      localStorage.setItem(JAR_STYLE_KEY, next);
      override = null;
    } catch {
      override = next;
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);
  return [style, setStyle];
}
