// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const sw = vi.hoisted(() => ({
  needRefresh: false,
  offlineReady: false,
  setNeedRefresh: vi.fn(),
  setOfflineReady: vi.fn(),
  updateServiceWorker: vi.fn(),
}));

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [sw.needRefresh, sw.setNeedRefresh],
    offlineReady: [sw.offlineReady, sw.setOfflineReady],
    updateServiceWorker: sw.updateServiceWorker,
  }),
}));

import UpdatePrompt from './UpdatePrompt.tsx';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  Object.assign(sw, { needRefresh: false, offlineReady: false });
  sw.setNeedRefresh.mockClear();
  sw.setOfflineReady.mockClear();
  sw.updateServiceWorker.mockClear();
});

describe('UpdatePrompt', () => {
  it('renders nothing by default', () => {
    const { container } = render(<UpdatePrompt />);
    expect(container.firstChild).toBeNull();
  });

  it('offers reload and dismiss when an update is available', () => {
    sw.needRefresh = true;
    render(<UpdatePrompt />);
    expect(screen.getByRole('status').textContent).toContain('A new version is available');
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(sw.updateServiceWorker).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole('button', { name: 'Later' }));
    expect(sw.setNeedRefresh).toHaveBeenCalledWith(false);
  });

  it('shows the offline toast and hides it after a delay', () => {
    vi.useFakeTimers();
    sw.offlineReady = true;
    render(<UpdatePrompt />);
    expect(screen.getByRole('status').textContent).toContain('Ready to work offline');
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(sw.setOfflineReady).toHaveBeenCalledWith(false);
  });
});
