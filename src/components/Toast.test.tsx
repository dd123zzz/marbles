// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ERROR_TOAST_MS, TOAST_MS, ToastProvider, useToast } from './Toast.tsx';

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
