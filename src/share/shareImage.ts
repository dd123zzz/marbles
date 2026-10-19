import { drawDayImage, drawWeekImage, DAY_IMAGE, WEEK_IMAGE, type ImageSize } from './drawJar';
import type { DateKey, Marble } from '../types';
import type { WeekImageDay } from './drawJar';

export type ShareSpec =
  | { kind: 'day'; date: DateKey; marbles: Marble[] }
  | { kind: 'week'; title: string; days: WeekImageDay[] };

/** Changes whenever the drawn image would change; used to decide when to re-render. */
export function shareSignature(spec: ShareSpec): string {
  const sig = (marbles: Marble[]) => marbles.map((m) => `${m.left}${m.right}`).join('');
  return spec.kind === 'day'
    ? `day|${spec.date}|${sig(spec.marbles)}`
    : `week|${spec.title}|${spec.days.map((d) => `${d.date}:${sig(d.marbles)}`).join('|')}`;
}

/** Draws the spec to a new canvas and encodes it as PNG; null when canvas is unavailable. */
export function renderShareBlob(spec: ShareSpec): Promise<Blob | null> {
  const size: ImageSize = spec.kind === 'day' ? DAY_IMAGE : WEEK_IMAGE;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(size.width * size.scale);
  canvas.height = Math.round(size.height * size.scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.resolve(null);
  if (spec.kind === 'day') drawDayImage(ctx, spec);
  else drawWeekImage(ctx, spec);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}

export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled';

function download(file: File): void {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Call this synchronously from the tap handler with an already-built file: iOS rejects
 * navigator.share unless it starts inside the user gesture. Falls back to a download.
 */
export function shareOrDownload(file: File, title: string): Promise<ShareOutcome> {
  const data = { files: [file], title };
  if (typeof navigator.share === 'function' && navigator.canShare?.(data)) {
    return navigator.share(data).then(
      () => 'shared' as const,
      (e: unknown) => {
        if (e instanceof Error && e.name === 'AbortError') return 'cancelled' as const;
        throw e;
      },
    );
  }
  try {
    download(file);
    return Promise.resolve('downloaded');
  } catch (e) {
    return Promise.reject(e instanceof Error ? e : new Error(String(e)));
  }
}
