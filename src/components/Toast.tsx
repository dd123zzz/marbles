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

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

export interface ToastApi {
  show: (message: string, kind?: ToastKind) => void;
  success: (message: string) => void;
  error: (message: string) => void;
}

export const TOAST_MS = 5000;
export const ERROR_TOAST_MS = 8000;
const MAX_TOASTS = 4;

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = nextId.current++;
    setToasts((list) => [...list, { id, kind, message }].slice(-MAX_TOASTS));
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (m) => show(m, 'success'),
      error: (m) => show(m, 'error'),
    }),
    [show],
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
  const { id, kind, message } = toast;
  useEffect(() => {
    const timer = window.setTimeout(
      () => onDismiss(id),
      kind === 'error' ? ERROR_TOAST_MS : TOAST_MS,
    );
    return () => window.clearTimeout(timer);
  }, [id, kind, onDismiss]);

  return (
    <div className={`toast toast-${kind}`} role={kind === 'error' ? 'alert' : undefined}>
      <span className="toast-icon" aria-hidden="true">
        {kind === 'error' ? '!' : kind === 'success' ? '✓' : 'i'}
      </span>
      <span className="toast-message">{message}</span>
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
