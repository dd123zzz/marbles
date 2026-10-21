import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type DayDoc } from './types';

describe('DEFAULT_SETTINGS', () => {
  it('defaults sleep start to 23:00', () => {
    expect(DEFAULT_SETTINGS.sleepStart).toBe('23:00');
  });
});

describe('DayDoc', () => {
  it('breaks is optional', () => {
    const doc: DayDoc = {
      slots: '.'.repeat(48),
      notes: {},
      sleep: { start: '23:00', end: '07:00' },
      tz: 'UTC',
      v: 1,
    };
    expect(doc.breaks).toBeUndefined();
    const withBreaks: DayDoc = { ...doc, breaks: '.'.repeat(48) };
    expect(withBreaks.breaks).toHaveLength(48);
  });
});
