// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ACTION_TOAST_MS,
  ERROR_TOAST_MS,
  TOAST_MS,
  ToastProvider,
  useToast,
  type ToastApi,
} from './Toast.tsx';

function Buttons() {
  const toast = useToast();
  return (
    <>
      <button onClick={() => toast.success('Saved it')}>ok</button>
      <button onClick={() => toast.error('Broke it')}>bad</button>
    </>
  );
}

const setup = () =>
  render(
    <ToastProvider>
      <Buttons />
    </ToastProvider>,
  );

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Toast', () => {
  it('announces success politely and auto-dismisses', () => {
    setup();
    fireEvent.click(screen.getByText('ok'));
    const status = screen.getByRole('status');
    expect(status.textContent).toContain('Saved it');
    expect(status.getAttribute('aria-live')).toBe('polite');
    act(() => {
      vi.advanceTimersByTime(TOAST_MS + 10);
    });
    expect(screen.queryByText('Saved it')).toBeNull();
  });

  it('uses role=alert for errors and dismisses on request', () => {
    setup();
    fireEvent.click(screen.getByText('bad'));
    expect(screen.getByRole('alert').textContent).toContain('Broke it');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('alert')).toBeNull();

    fireEvent.click(screen.getByText('bad'));
    act(() => {
      vi.advanceTimersByTime(ERROR_TOAST_MS + 10);
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('stacks several toasts', () => {
    setup();
    fireEvent.click(screen.getByText('ok'));
    fireEvent.click(screen.getByText('ok'));
    expect(screen.getAllByText('Saved it')).toHaveLength(2);
  });
});

function Actor({ run }: { run: (toast: ToastApi) => void }) {
  const toast = useToast();
  return <button onClick={() => run(toast)}>run</button>;
}

const renderWith = (run: (toast: ToastApi) => void) =>
  render(
    <ToastProvider>
      <Actor run={run} />
    </ToastProvider>,
  );
const trigger = () => fireEvent.click(screen.getByText('run'));
const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

describe('Toast action button', () => {
  it('calls onAction once and dismisses the toast when clicked', () => {
    const onAction = vi.fn();
    renderWith((t) => t.show('Logged 13:30', { action: { label: 'Undo', onAction } }));
    trigger();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Logged 13:30')).toBeNull();
    advance(ACTION_TOAST_MS + 10);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('is a real button inside the live region and does not steal focus', () => {
    renderWith((t) => t.show('Logged', { action: { label: 'Undo', onAction: () => {} } }));
    trigger();
    const undo = screen.getByRole('button', { name: 'Undo' });
    expect(undo.tagName).toBe('BUTTON');
    expect(undo.tabIndex).toBe(0);
    expect(undo.closest('[role="status"]')).not.toBeNull();
    expect(screen.getByRole('status').getAttribute('aria-live')).toBe('polite');
    expect(document.activeElement).toBe(document.body);
  });

  it('dismissing with the close button does not call onAction', () => {
    const onAction = vi.fn();
    renderWith((t) => t.show('Logged', { action: { label: 'Undo', onAction } }));
    trigger();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText('Logged')).toBeNull();
    expect(onAction).not.toHaveBeenCalled();
  });

  it('lasts 8 s by default when it has an action', () => {
    renderWith((t) => t.show('Logged', { action: { label: 'Undo', onAction: () => {} } }));
    trigger();
    advance(TOAST_MS + 10);
    expect(screen.getByText('Logged')).toBeTruthy();
    advance(ACTION_TOAST_MS - TOAST_MS);
    expect(screen.queryByText('Logged')).toBeNull();
  });

  it('works on error toasts and keeps the alert role', () => {
    const onAction = vi.fn();
    renderWith((t) => t.error('Could not undo', { action: { label: 'Retry', onAction } }));
    trigger();
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Could not undo');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('Toast durationMs', () => {
  it('overrides the default for action toasts', () => {
    renderWith((t) =>
      t.show('Short', { durationMs: 2000, action: { label: 'Undo', onAction: () => {} } }),
    );
    trigger();
    advance(1990);
    expect(screen.getByText('Short')).toBeTruthy();
    advance(20);
    expect(screen.queryByText('Short')).toBeNull();
  });

  it('overrides the default for plain toasts and success/error options', () => {
    renderWith((t) => {
      t.show('Quick', { durationMs: 1000 });
      t.success('Done fast', { durationMs: 1500 });
      t.error('Oops fast', { durationMs: 500 });
    });
    trigger();
    advance(490);
    expect(screen.getByText('Oops fast')).toBeTruthy();
    advance(20);
    expect(screen.queryByText('Oops fast')).toBeNull();
    expect(screen.getByText('Quick')).toBeTruthy();
    advance(500);
    expect(screen.queryByText('Quick')).toBeNull();
    expect(screen.getByText('Done fast')).toBeTruthy();
    advance(500);
    expect(screen.queryByText('Done fast')).toBeNull();
  });
});

describe('Toast key replacement', () => {
  it('replaces the toast with the same key, so only the newest action applies', () => {
    const undoA = vi.fn();
    const undoB = vi.fn();
    renderWith((t) => {
      t.show('Logged A', { key: 'drop', action: { label: 'Undo', onAction: undoA } });
      t.show('Logged B', { key: 'drop', action: { label: 'Undo', onAction: undoB } });
    });
    trigger();
    expect(screen.queryByText('Logged A')).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Undo' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(undoB).toHaveBeenCalledTimes(1);
    expect(undoA).not.toHaveBeenCalled();
  });

  it('restarts the timer when a keyed toast is replaced', () => {
    let calls = 0;
    renderWith((t) => {
      if (calls++ === 0) t.show('First', { key: 'drop' });
      else t.show('Second', { key: 'drop' });
    });
    trigger();
    advance(TOAST_MS - 1000);
    trigger();
    expect(screen.queryByText('First')).toBeNull();
    advance(TOAST_MS - 1000 + 10);
    expect(screen.getByText('Second')).toBeTruthy();
    advance(1000);
    expect(screen.queryByText('Second')).toBeNull();
  });

  it('keeps toasts without a matching key', () => {
    renderWith((t) => {
      t.show('Plain');
      t.show('A', { key: 'k' });
      t.show('B', { key: 'k' });
    });
    trigger();
    expect(screen.getByText('Plain')).toBeTruthy();
    expect(screen.queryByText('A')).toBeNull();
    expect(screen.getByText('B')).toBeTruthy();
  });
});

describe('Toast dismissKey', () => {
  it('removes only the toast with that key', () => {
    renderWith((t) => {
      t.show('Plain');
      t.show('Keyed', { key: 'drop', action: { label: 'Undo', onAction: vi.fn() } });
      t.show('Other', { key: 'other' });
      t.dismissKey('drop');
    });
    trigger();
    expect(screen.getByText('Plain')).toBeTruthy();
    expect(screen.getByText('Other')).toBeTruthy();
    expect(screen.queryByText('Keyed')).toBeNull();
  });

  it('is a no-op when nothing has the key, and later toasts with it still show', () => {
    let calls = 0;
    renderWith((t) => {
      if (calls++ === 0) {
        t.show('Kept');
        t.dismissKey('drop');
      } else {
        t.show('Again', { key: 'drop' });
      }
    });
    trigger();
    expect(screen.getByText('Kept')).toBeTruthy();
    trigger();
    expect(screen.getByText('Again')).toBeTruthy();
  });
});

describe('Toast backward-compatible show()', () => {
  it('still accepts a kind string as the second argument', () => {
    renderWith((t) => t.show('Oops', 'error'));
    trigger();
    expect(screen.getByRole('alert').textContent).toContain('Oops');
  });

  it('accepts an options object with kind and no action', () => {
    renderWith((t) => t.show('Saved', { kind: 'success' }));
    trigger();
    const toast = screen.getByText('Saved').closest('.toast');
    expect(toast?.classList.contains('toast-success')).toBe(true);
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  });

  it('defaults to info and 5 s when called with only a message', () => {
    renderWith((t) => t.show('Plain info'));
    trigger();
    const toast = screen.getByText('Plain info').closest('.toast');
    expect(toast?.classList.contains('toast-info')).toBe(true);
    advance(TOAST_MS - 10);
    expect(screen.getByText('Plain info')).toBeTruthy();
    advance(20);
    expect(screen.queryByText('Plain info')).toBeNull();
  });

  it('keeps the existing error duration', () => {
    renderWith((t) => t.error('Broke'));
    trigger();
    advance(ERROR_TOAST_MS - 10);
    expect(screen.getByText('Broke')).toBeTruthy();
    advance(20);
    expect(screen.queryByText('Broke')).toBeNull();
  });
});
