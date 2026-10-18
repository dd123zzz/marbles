import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './types';

describe('DEFAULT_SETTINGS', () => {
  it('defaults sleep start to 23:00', () => {
    expect(DEFAULT_SETTINGS.sleepStart).toBe('23:00');
  });
});
