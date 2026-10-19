/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import './toast.css';

export type ToastKind = 'info' | 'success' | 'error';

export interface ToastAction {
  label: string;
  onAction: () => void;
}

export interface ToastOptions {
  kind?: ToastKind;
  /** Renders a button in the toast. Clicking it calls onAction once and dismisses the toast. */
  action?: ToastAction;
  /** Overrides the default: 8000 ms with an action, 8000 ms for errors, otherwise 5000 ms. */
  durationMs?: number;
  /** A toast shown with the same key replaces the one already on screen. */
  key?: string;
}

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
  action?: ToastAction;
  durationMs: number;
  key?: string;
}

export interface ToastApi {
  /** Accepts a kind (`show(msg, 'error')`) or an options object (`show(msg, { action })`). */
  show: (message: string, kindOrOptions?: ToastKind | ToastOptions) => void;
  success: (message: string, options?: Omit<ToastOptions, 'kind'>) => void;
  error: (message: string, options?: Omit<ToastOptions, 'kind'>) => void;
  /** Removes the toast on screen with this key, if any. */
  dismissKey: (key: string) => void;
}

export const TOAST_MS = 5000;
export const ERROR_TOAST_MS = 8000;
export const ACTION_TOAST_MS = 8000;
const MAX_TOASTS = 4;

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((message: string, kindOrOptions: ToastKind | ToastOptions = 'info') => {
    const opts: ToastOptions =
      typeof kindOrOptions === 'string' ? { kind: kindOrOptions } : kindOrOptions;
    const kind = opts.kind ?? 'info';
    const defaultMs = opts.action ? ACTION_TOAST_MS : kind === 'error' ? ERROR_TOAST_MS : TOAST_MS;
    const item: ToastItem = {
      id: nextId.current++,
      kind,
      message,
      action: opts.action,
      durationMs: opts.durationMs ?? defaultMs,
      key: opts.key,
    };
    setToasts((list) => {
      const kept = opts.key === undefined ? list : list.filter((t) => t.key !== opts.key);
      return [...kept, item].slice(-MAX_TOASTS);
    });
  }, []);

  const dismissKey = useCallback((key: string) => {
    setToasts((list) =>
      list.some((t) => t.key === key) ? list.filter((t) => t.key !== key) : list,
    );
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (m, options) => show(m, { ...options, kind: 'success' }),
      error: (m, options) => show(m, { ...options, kind: 'error' }),
      dismissKey,
    }),
    [show, dismissKey],
  );

  const errors = toasts.filter((t) => t.kind === 'error');
  const others = toasts.filter((t) => t.kind !== 'error');

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-viewport">
        <div role="status" aria-live="polite" className="toast-stack">
          {others.map((t) => (
            <ToastView key={t.id} toast={t} onDismiss={dismiss} />
          ))}
        </div>
        {errors.length > 0 && (
          <div className="toast-stack">
            {errors.map((t) => (
              <ToastView key={t.id} toast={t} onDismiss={dismiss} />
            ))}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

function ToastView({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  const { id, kind, message, action, durationMs } = toast;
  const acted = useRef(false);
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(id), durationMs);
    return () => window.clearTimeout(timer);
  }, [id, durationMs, onDismiss]);

  const onActionClick = () => {
    if (!action || acted.current) return;
    acted.current = true;
    onDismiss(id);
    action.onAction();
  };

  return (
    <div className={`toast toast-${kind}`} role={kind === 'error' ? 'alert' : undefined}>
      <span className="toast-icon" aria-hidden="true">
        {kind === 'error' ? '!' : kind === 'success' ? '✓' : 'i'}
      </span>
      <span className="toast-message">{message}</span>
      {action && (
        <button type="button" className="toast-action" onClick={onActionClick}>
          {action.label}
        </button>
      )}
      <button
        type="button"
        className="toast-close"
        aria-label="Dismiss"
        onClick={() => onDismiss(id)}
      >
        ×
      </button>
    </div>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
