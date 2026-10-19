import { describe, expect, it } from 'vitest';
import { buildReminderIcs, escapeText, foldLine, reminderHours } from './ics';

const NOW = new Date(2026, 9, 18, 14, 5, 9);
const APP = 'https://dd123zzz.github.io/marbles/';
const build = (start: string, end: string) =>
  buildReminderIcs({ sleep: { start, end }, appUrl: APP, now: NOW });
const count = (s: string, needle: string) => s.split(needle).length - 1;

describe('reminderHours', () => {
  it('covers each awake hour: 23:00–07:00 gives 08:00..23:00', () => {
    const h = reminderHours({ start: '23:00', end: '07:00' });
    expect(h).toEqual([8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]);
  });

  it('handles a sleep window that does not wrap: 01:00–09:00', () => {
    const h = reminderHours({ start: '01:00', end: '09:00' });
    expect(h).toEqual([0, 1, ...Array.from({ length: 14 }, (_, i) => i + 10)]);
    expect(h).toHaveLength(16);
  });

  it('trims half-hour edges so each previous hour is fully awake', () => {
    expect(reminderHours({ start: '23:00', end: '07:30' })).toEqual(
      Array.from({ length: 15 }, (_, i) => i + 9),
    );
    expect(reminderHours({ start: '22:30', end: '07:00' })).toEqual(
      Array.from({ length: 15 }, (_, i) => i + 8),
    );
  });

  it('reminds every hour when start equals end (no sleep)', () => {
    expect(reminderHours({ start: '00:00', end: '00:00' })).toHaveLength(24);
  });

  it('has no reminders when almost all day is sleep', () => {
    expect(reminderHours({ start: '00:00', end: '23:30' })).toEqual([]);
  });
});

describe('buildReminderIcs', () => {
  it('uses CRLF everywhere and ends with a CRLF', () => {
    const ics = build('23:00', '07:00');
    expect(ics.endsWith('\r\n')).toBe(true);
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
  });

  it('has the calendar header and footer', () => {
    const lines = build('23:00', '07:00').split('\r\n');
    expect(lines[0]).toBe('BEGIN:VCALENDAR');
    expect(lines).toContain('VERSION:2.0');
    expect(lines.some((l) => l.startsWith('PRODID:'))).toBe(true);
    expect(lines[lines.length - 2]).toBe('END:VCALENDAR');
  });

  it.each([
    ['23:00', '07:00', 16],
    ['01:00', '09:00', 16],
    ['22:30', '07:30', 14],
    ['00:00', '00:00', 24],
  ])('sleep %s–%s makes %i events', (s, e, n) => {
    const ics = build(s, e);
    expect(count(ics, 'BEGIN:VEVENT')).toBe(n);
    expect(count(ics, 'END:VEVENT')).toBe(n);
    expect(count(ics, 'RRULE:FREQ=DAILY')).toBe(n);
    expect(count(ics, 'BEGIN:VALARM')).toBe(n);
  });

  it('writes floating local DTSTARTs from the first reminder hour, with unique UIDs', () => {
    const ics = build('23:00', '07:00');
    expect(ics).toContain('DTSTART:20261018T080000\r\n');
    expect(ics).toContain('DTSTART:20261018T230000\r\n');
    expect(ics).not.toContain('DTSTART:20261018T070000');
    expect(ics).not.toMatch(/DTSTART[^\r]*(TZID|Z\r)/);
    const uids = [...ics.matchAll(/^UID:(.+)$/gm)].map((m) => m[1]);
    expect(new Set(uids).size).toBe(16);
  });

  it('has DTSTAMP in UTC, a 5-minute duration, summary, url and a trigger-at-start alarm', () => {
    const ics = build('23:00', '07:00');
    expect(ics).toMatch(/DTSTAMP:\d{8}T\d{6}Z\r\n/);
    expect(ics).toContain('DURATION:PT5M\r\n');
    expect(ics).toContain('SUMMARY:Log your marbles\r\n');
    expect(ics).toContain(`URL:${APP}\r\n`);
    expect(ics).toContain('ACTION:DISPLAY\r\nTRIGGER:PT0S\r\n');
  });

  it('never exceeds 75 octets per line', () => {
    const ics = buildReminderIcs({
      sleep: { start: '23:00', end: '07:00' },
      appUrl: `${APP}${'long/'.repeat(30)}`,
      now: NOW,
    });
    for (const line of ics.split('\r\n')) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
  });

  it('is empty of events when there are no awake hours', () => {
    const ics = build('00:00', '23:30');
    expect(ics).not.toContain('BEGIN:VEVENT');
    expect(ics).toContain('END:VCALENDAR');
  });
});

describe('escapeText', () => {
  it('escapes backslash, semicolon, comma and newlines', () => {
    expect(escapeText('a,b;c\\d\ne\r\nf')).toBe('a\\,b\\;c\\\\d\\ne\\nf');
  });

  it('leaves plain text alone', () => {
    expect(escapeText('Log your marbles: now')).toBe('Log your marbles: now');
  });
});

describe('foldLine', () => {
  it('leaves short lines alone', () => {
    expect(foldLine('SUMMARY:hi')).toBe('SUMMARY:hi');
    expect(foldLine('x'.repeat(75))).toBe('x'.repeat(75));
  });

  it('folds at 75 octets with a leading space on continuations', () => {
    const folded = foldLine('x'.repeat(200)).split('\r\n');
    expect(folded[0]).toHaveLength(75);
    expect(folded[1]).toBe(` ${'x'.repeat(74)}`);
    expect(folded.map((l, i) => (i ? l.slice(1) : l)).join('')).toBe('x'.repeat(200));
  });

  it('never splits a multibyte character', () => {
    const text = 'D:' + 'é'.repeat(100) + '—😀'.repeat(20);
    const folded = foldLine(text).split('\r\n');
    for (const l of folded) {
      expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
    }
    expect(folded.map((l, i) => (i ? l.slice(1) : l)).join('')).toBe(text);
  });
});
