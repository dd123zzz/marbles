// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../components/Toast.tsx';
import ShareButton from './ShareButton.tsx';
import { shareOrDownload, shareSignature } from './shareImage';

const file = () => new File([new Uint8Array([1, 2, 3])], 'day.png', { type: 'image/png' });

function setNavigator(share?: unknown, canShare?: unknown) {
  Object.defineProperty(navigator, 'share', { value: share, configurable: true });
  Object.defineProperty(navigator, 'canShare', { value: canShare, configurable: true });
}

let clicked: HTMLAnchorElement[];

beforeEach(() => {
  clicked = [];
  URL.createObjectURL = vi.fn(() => 'blob:fake');
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    clicked.push(this);
  });
});
afterEach(() => {
  cleanup();
  setNavigator(undefined, undefined);
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('shareOrDownload', () => {
  it('shares the file when the browser can share files', async () => {
    const share = vi.fn(async () => {});
    const canShare = vi.fn(() => true);
    setNavigator(share, canShare);
    const f = file();
    await expect(shareOrDownload(f, 'Title')).resolves.toBe('shared');
    expect(canShare).toHaveBeenCalledWith({ files: [f], title: 'Title' });
    expect(share).toHaveBeenCalledWith({ files: [f], title: 'Title' });
    expect(clicked).toHaveLength(0);
  });

  it('downloads when canShare says no', async () => {
    const share = vi.fn(async () => {});
    setNavigator(share, () => false);
    await expect(shareOrDownload(file(), 'Title')).resolves.toBe('downloaded');
    expect(share).not.toHaveBeenCalled();
    expect(clicked).toHaveLength(1);
    expect(clicked[0].download).toBe('day.png');
    expect(clicked[0].href).toContain('blob:fake');
  });

  it('downloads when the share API is missing entirely', async () => {
    setNavigator(undefined, undefined);
    await expect(shareOrDownload(file(), 'Title')).resolves.toBe('downloaded');
    expect(clicked).toHaveLength(1);
  });

  it('treats a dismissed share sheet (AbortError) as a cancel', async () => {
    const abort = Object.assign(new Error('cancelled'), { name: 'AbortError' });
    setNavigator(
      vi.fn(async () => {
        throw abort;
      }),
      () => true,
    );
    await expect(shareOrDownload(file(), 'T')).resolves.toBe('cancelled');
  });

  it('rejects on other share errors', async () => {
    setNavigator(
      vi.fn(async () => {
        throw new Error('boom');
      }),
      () => true,
    );
    await expect(shareOrDownload(file(), 'T')).rejects.toThrow('boom');
  });

  it('calls navigator.share synchronously', () => {
    const share = vi.fn(async () => {});
    setNavigator(share, () => true);
    void shareOrDownload(file(), 'T');
    expect(share).toHaveBeenCalledTimes(1);
  });
});

describe('shareSignature', () => {
  it('changes with the marbles and not with labels', () => {
    const m = (left: 'g' | 'b') => [
      { hour: 0, left, right: left, full: true, label: 'x' as string },
    ];
    expect(shareSignature({ kind: 'day', date: 'd', marbles: m('g') })).not.toBe(
      shareSignature({ kind: 'day', date: 'd', marbles: m('b') }),
    );
    expect(shareSignature({ kind: 'day', date: 'd', marbles: m('g') })).toBe(
      shareSignature({ kind: 'day', date: 'd', marbles: m('g') }),
    );
  });
});

describe('ShareButton', () => {
  const spec = {
    kind: 'day' as const,
    date: '2026-10-18',
    marbles: [{ hour: 0, left: 'g' as const, right: 'g' as const, full: true, label: 'x' }],
  };

  function stubCanvas(ctx: unknown) {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as never);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb) =>
      cb(new Blob(['png'], { type: 'image/png' })),
    );
  }

  it('is disabled until the image is built, then shares synchronously on tap', async () => {
    const share = vi.fn(async () => {});
    setNavigator(share, () => true);
    const noop = () => {};
    const ctx = new Proxy({ createLinearGradient: () => ({ addColorStop: noop }) } as object, {
      get: (t, p) => (p in t ? (t as Record<string | symbol, unknown>)[p] : noop),
      set: () => true,
    });
    vi.stubGlobal('Path2D', class {});
    stubCanvas(ctx);
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <ShareButton spec={spec} label="Share day image" title="T" filename="f" />
      </ToastProvider>,
    );
    const btn = screen.getByRole('button', { name: 'Share day image' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    expect(share).toHaveBeenCalledTimes(1);
    const arg = (share.mock.calls[0] as unknown[])[0] as { files: File[] };
    expect(arg.files[0].name).toBe('f.png');
    vi.unstubAllGlobals();
  });

  it('stays disabled when canvas is unavailable', async () => {
    stubCanvas(null);
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <ShareButton spec={spec} label="Share day image" title="T" filename="f" />
      </ToastProvider>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
  });
});
