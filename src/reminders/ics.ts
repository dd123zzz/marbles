import { isInSleepWindow } from '../lib/time';
import type { SleepWindow } from '../types';

const CRLF = '\r\n';
const MAX_OCTETS = 75;
const pad = (n: number): string => String(n).padStart(2, '0');

/** Escapes a TEXT value (RFC 5545 §3.3.11). */
export function escapeText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/** Folds a content line at 75 octets without splitting a UTF-8 character; continuations start with a space. */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  const parts: string[] = [];
  let current = '';
  let octets = 0;
  for (const ch of line) {
    const size = enc.encode(ch).length;
    // continuation lines carry a leading space that also counts
    const limit = parts.length === 0 ? MAX_OCTETS : MAX_OCTETS - 1;
    if (octets + size > limit) {
      parts.push(current);
      current = '';
      octets = 0;
    }
    current += ch;
    octets += size;
  }
  parts.push(current);
  return parts.join(CRLF + ' ');
}

/**
 * Hours (0..23) at which to remind: the top of each hour whose previous hour is
 * entirely awake. A sleep window that starts or ends mid-hour trims that edge,
 * e.g. sleep 23:00–07:30 gives 09:00..23:00 and 22:30–07:00 gives 08:00..22:00.
 */
export function reminderHours(sleep: SleepWindow): number[] {
  const hours: number[] = [];
  for (let h = 0; h < 24; h++) {
    const prevFirstSlot = ((h + 23) % 24) * 2;
    if (!isInSleepWindow(prevFirstSlot, sleep) && !isInSleepWindow(prevFirstSlot + 1, sleep)) {
      hours.push(h);
    }
  }
  return hours;
}

function utcStamp(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

export interface IcsOptions {
  sleep: SleepWindow;
  /** Link placed in each event, e.g. https://example.com/marbles/ */
  appUrl: string;
  /** Used for DTSTAMP and the first occurrence date. Defaults to the current time. */
  now?: Date;
}

/**
 * One recurring daily VEVENT per reminder hour. DTSTART uses floating local
 * time (no TZID, no "Z") so the reminders follow the device's time zone.
 * UIDs are stable, so re-importing updates events instead of duplicating them.
 */
export function buildReminderIcs({ sleep, appUrl, now = new Date() }: IcsOptions): string {
  const startDate = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const stamp = utcStamp(now);
  const description = escapeText(`Log the last hour in Marbles: ${appUrl}`);

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Marbles//Hourly reminders//EN',
    'CALSCALE:GREGORIAN',
  ];
  for (const h of reminderHours(sleep)) {
    const hh = pad(h);
    lines.push(
      'BEGIN:VEVENT',
      `UID:marbles-reminder-${hh}00@marbles`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${startDate}T${hh}0000`,
      'DURATION:PT5M',
      'RRULE:FREQ=DAILY',
      'SUMMARY:Log your marbles',
      `DESCRIPTION:${description}`,
      `URL:${appUrl}`,
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'TRIGGER:PT0S',
      'DESCRIPTION:Log your marbles',
      'END:VALARM',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join(CRLF) + CRLF;
}

export const ICS_FILENAME = 'marbles-reminders.ics';

export function downloadIcs(text: string, filename = ICS_FILENAME): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/calendar;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
