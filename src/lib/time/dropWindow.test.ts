import { describe, expect, it } from 'vitest';
import type { SleepWindow, SlotRef } from '../../types';
import { nextDropWindow } from './index';

const at = (y: number, mo: number, d: number, h: number, mi: number, s = 0): Date =>
  new Date(y, mo - 1, d, h, mi, s);
const june = (h: number, mi: number, s = 0): Date => at(2026, 6, 10, h, mi, s);
const T = '2026-06-10';
const Y = '2026-06-09';
const DST = '2026-03-08';

const NIGHT: SleepWindow = { start: '23:00', end: '07:00' };
const NO_SLEEP: SleepWindow = { start: '22:00', end: '22:00' };

/** Build a 48-char slots string with `cat` over [from, to) given as "HH:mm" or hour numbers. */
const slotOf = (t: string): number => {
  const [h, m] = t.split(':').map(Number);
  return h! * 2 + (m! >= 30 ? 1 : 0);
};
const mask = (...runs: Array<[string, string, string]>): string => {
  const a = Array<string>(48).fill('.');
  for (const [cat, from, to] of runs) {
    for (let i = slotOf(from); i < slotOf(to); i++) a[i] = cat;
  }
  return a.join('');
};
const refs = (date: string, ...slots: number[]): SlotRef[] => slots.map((slot) => ({ date, slot }));

describe('nextDropWindow (TZ America/Los_Angeles)', () => {
  it('runs in the pinned timezone', () => {
    expect(new Date(2026, 2, 8, 3, 10).getTimezoneOffset()).toBe(420);
  });

  describe('test matrix', () => {
    it('10:10, g 07:00–09:00 -> gap 09:00–10:00', () => {
      expect(
        nextDropWindow({ slots: mask(['g', '07:00', '09:00']), sleep: NIGHT, now: june(10, 10) }),
      ).toEqual({ kind: 'gap', targets: refs(T, 18, 19) });
    });

    it('10:12, g 07:00–10:00 -> lastHour 09:00–10:00', () => {
      expect(
        nextDropWindow({ slots: mask(['g', '07:00', '10:00']), sleep: NIGHT, now: june(10, 12) }),
      ).toEqual({ kind: 'lastHour', targets: refs(T, 18, 19) });
    });

    it('14:44, g ..13:00 -> gap 13:00–14:00', () => {
      expect(
        nextDropWindow({ slots: mask(['g', '07:00', '13:00']), sleep: NIGHT, now: june(14, 44) }),
      ).toEqual({ kind: 'gap', targets: refs(T, 26, 27) });
    });

    it('14:44, p ..13:00 -> gap 13:00–14:00 (a p slot anchors the window like any logged slot)', () => {
      expect(
        nextDropWindow({ slots: mask(['p', '07:00', '13:00']), sleep: NIGHT, now: june(14, 44) }),
      ).toEqual({ kind: 'gap', targets: refs(T, 26, 27) });
    });

    it('14:44, g ..14:00 -> gap 14:00–14:30 (one slot, capped at E=29)', () => {
      expect(
        nextDropWindow({ slots: mask(['g', '07:00', '14:00']), sleep: NIGHT, now: june(14, 44) }),
      ).toEqual({ kind: 'gap', targets: refs(T, 28) });
    });

    it('14:44, g ..14:30 -> lastHour 13:30–14:30', () => {
      expect(
        nextDropWindow({ slots: mask(['g', '07:00', '14:30']), sleep: NIGHT, now: june(14, 44) }),
      ).toEqual({ kind: 'lastHour', targets: refs(T, 27, 28) });
    });

    it('09:20, no doc -> gap 07:00–08:00 (morning sleep is covered)', () => {
      expect(nextDropWindow({ slots: undefined, sleep: NIGHT, now: june(9, 20) })).toEqual({
        kind: 'gap',
        targets: refs(T, 14, 15),
      });
    });

    it('06:10, nothing logged, still in morning sleep -> lastHour 05:00–06:00', () => {
      expect(nextDropWindow({ slots: undefined, sleep: NIGHT, now: june(6, 10) })).toEqual({
        kind: 'lastHour',
        targets: refs(T, 10, 11),
      });
    });

    it('03:10, no sleep, nothing logged -> gap 00:00–01:00', () => {
      expect(nextDropWindow({ slots: undefined, sleep: NO_SLEEP, now: june(3, 10) })).toEqual({
        kind: 'gap',
        targets: refs(T, 0, 1),
      });
    });

    it('03:10, non-wrapping sleep 01:00–08:00 -> lastHour 02:00–03:00', () => {
      expect(
        nextDropWindow({
          slots: undefined,
          sleep: { start: '01:00', end: '08:00' },
          now: june(3, 10),
        }),
      ).toEqual({ kind: 'lastHour', targets: refs(T, 4, 5) });
    });

    it('00:10 -> lastHour yesterday 23:00–24:00 regardless of slots', () => {
      const expected = { kind: 'lastHour', targets: refs(Y, 46, 47) };
      expect(nextDropWindow({ slots: undefined, sleep: NIGHT, now: june(0, 10) })).toEqual(
        expected,
      );
      expect(nextDropWindow({ slots: undefined, sleep: NO_SLEEP, now: june(0, 10) })).toEqual(
        expected,
      );
      expect(
        nextDropWindow({ slots: mask(['g', '00:00', '01:00']), sleep: NO_SLEEP, now: june(0, 10) }),
      ).toEqual(expected);
    });

    it('00:20, no sleep, nothing logged -> gap today 00:00–00:30 only', () => {
      expect(nextDropWindow({ slots: undefined, sleep: NO_SLEEP, now: june(0, 20) })).toEqual({
        kind: 'gap',
        targets: refs(T, 0),
      });
    });

    it('00:20 with usual sleep -> lastHour yesterday 23:30 to today 00:30', () => {
      expect(nextDropWindow({ slots: undefined, sleep: NIGHT, now: june(0, 20) })).toEqual({
        kind: 'lastHour',
        targets: [
          { date: Y, slot: 47 },
          { date: T, slot: 0 },
        ],
      });
    });

    it('23:40, g ..21:00: gap 21–22, gap 22–23, gap 23:00–23:30, then lastHour 22:30–23:30', () => {
      const now = june(23, 40);
      let slots = mask(['g', '07:00', '21:00']);
      const w1 = nextDropWindow({ slots, sleep: NIGHT, now });
      expect(w1).toEqual({ kind: 'gap', targets: refs(T, 42, 43) });

      slots = mask(['g', '07:00', '22:00']);
      const w2 = nextDropWindow({ slots, sleep: NIGHT, now });
      expect(w2).toEqual({ kind: 'gap', targets: refs(T, 44, 45) });

      slots = mask(['g', '07:00', '23:00']);
      const w3 = nextDropWindow({ slots, sleep: NIGHT, now });
      expect(w3).toEqual({ kind: 'gap', targets: refs(T, 46) });

      slots = mask(['g', '07:00', '23:30']);
      const w4 = nextDropWindow({ slots, sleep: NIGHT, now });
      expect(w4).toEqual({ kind: 'lastHour', targets: refs(T, 45, 46) });
    });

    it('2026-03-08 03:10, no sleep, g ..01:30 -> gap 01:30–02:00 (02:00–03:00 does not exist)', () => {
      expect(
        nextDropWindow({
          slots: mask(['g', '00:00', '01:30']),
          sleep: NO_SLEEP,
          now: at(2026, 3, 8, 3, 10),
        }),
      ).toEqual({ kind: 'gap', targets: refs(DST, 3) });
    });

    it('2026-03-08 04:10, no sleep, g ..01:30 -> gap 01:30–02:00 + 03:00–03:30', () => {
      expect(
        nextDropWindow({
          slots: mask(['g', '00:00', '01:30']),
          sleep: NO_SLEEP,
          now: at(2026, 3, 8, 4, 10),
        }),
      ).toEqual({ kind: 'gap', targets: refs(DST, 3, 6) });
    });

    it('15:00 after Undo of a 13–14 gap drop -> same gap 13:00–14:00 again', () => {
      const before = mask(['g', '07:00', '13:00']);
      const afterDrop = mask(['g', '07:00', '14:00']);
      const now = june(15, 0);
      const first = nextDropWindow({ slots: before, sleep: NIGHT, now });
      expect(first).toEqual({ kind: 'gap', targets: refs(T, 26, 27) });
      // The drop advances the window.
      expect(nextDropWindow({ slots: afterDrop, sleep: NIGHT, now })).toEqual({
        kind: 'gap',
        targets: refs(T, 28, 29),
      });
      // Undo restores the slots, so the same window comes back.
      expect(nextDropWindow({ slots: before, sleep: NIGHT, now })).toEqual(first);
    });
  });

  describe('edge cases', () => {
    it('different-category repeat drops advance (anchor is any logged slot)', () => {
      expect(
        nextDropWindow({
          slots: mask(['g', '07:00', '09:00'], ['b', '09:00', '10:00']),
          sleep: NIGHT,
          now: june(12, 10),
        }),
      ).toEqual({ kind: 'gap', targets: refs(T, 20, 21) });
    });

    it('anchor is the latest logged slot; earlier gaps are not revisited', () => {
      expect(
        nextDropWindow({
          slots: mask(['g', '08:00', '09:00'], ['r', '13:00', '14:00']),
          sleep: NIGHT,
          now: june(16, 10),
        }),
      ).toEqual({ kind: 'gap', targets: refs(T, 28, 29) });
    });

    it('a logged in-progress slot is the anchor and falls back to lastHour', () => {
      // 14:10 -> E = 28; slot 28 (14:00–14:30) logged -> G = 29 >= 28.
      expect(
        nextDropWindow({
          slots: mask(['g', '07:00', '14:30']),
          sleep: NIGHT,
          now: june(14, 10),
        }),
      ).toEqual({ kind: 'lastHour', targets: refs(T, 26, 27) });
    });

    it('a gap before E is capped: 1 slot fits -> logs 30 minutes', () => {
      expect(
        nextDropWindow({
          slots: mask(['g', '07:00', '13:30']),
          sleep: NIGHT,
          now: june(14, 14),
        }),
      ).toEqual({ kind: 'gap', targets: refs(T, 27) });
    });

    it('no slots fit below E -> lastHour', () => {
      expect(
        nextDropWindow({
          slots: mask(['g', '07:00', '14:00']),
          sleep: NIGHT,
          now: june(14, 14),
        }),
      ).toEqual({ kind: 'lastHour', targets: refs(T, 26, 27) });
    });

    it('evening sleep that has started counts as unlogged (23:20, sleep 23:00)', () => {
      // E = 47. Anchor is the last logged slot (21:00), the gap runs through sleep.
      expect(
        nextDropWindow({
          slots: mask(['g', '07:00', '22:00']),
          sleep: NIGHT,
          now: june(23, 20),
        }),
      ).toEqual({ kind: 'gap', targets: refs(T, 44, 45) });
    });

    it('evening sleep is not covered even when now is inside it and nothing is logged after wake', () => {
      expect(nextDropWindow({ slots: undefined, sleep: NIGHT, now: june(23, 40) })).toEqual({
        kind: 'gap',
        targets: refs(T, 14, 15),
      });
    });

    it('daytime non-wrapping sleep never anchors (13:00–15:00 at 16:10 -> gap from 00:00)', () => {
      expect(
        nextDropWindow({
          slots: undefined,
          sleep: { start: '13:00', end: '15:00' },
          now: june(16, 10),
        }),
      ).toEqual({ kind: 'gap', targets: refs(T, 0, 1) });
    });

    describe('non-wrapping sleep windows', () => {
      it('13:00–20:00 at 10:10, empty day -> gap 00:00–01:00', () => {
        expect(
          nextDropWindow({
            slots: undefined,
            sleep: { start: '13:00', end: '20:00' },
            now: june(10, 10),
          }),
        ).toEqual({ kind: 'gap', targets: refs(T, 0, 1) });
      });

      it('21:00–23:00 at 22:30, empty day -> gap 00:00–01:00', () => {
        expect(
          nextDropWindow({
            slots: undefined,
            sleep: { start: '21:00', end: '23:00' },
            now: june(22, 30),
          }),
        ).toEqual({ kind: 'gap', targets: refs(T, 0, 1) });
      });

      it('01:00–08:00 at 10:10, empty day -> gap 08:00–09:00 (morning sleep has ended)', () => {
        expect(
          nextDropWindow({
            slots: undefined,
            sleep: { start: '01:00', end: '08:00' },
            now: june(10, 10),
          }),
        ).toEqual({ kind: 'gap', targets: refs(T, 16, 17) });
      });

      it('01:00–08:00 at 03:10 stays lastHour 02:00–03:00 (sleep started, nothing after it)', () => {
        expect(
          nextDropWindow({
            slots: undefined,
            sleep: { start: '01:00', end: '08:00' },
            now: june(3, 10),
          }),
        ).toEqual({ kind: 'lastHour', targets: refs(T, 4, 5) });
      });

      it('a not-yet-started morning sleep does not hide logged slots before it', () => {
        // sleep 09:00–11:00, now 08:10 (E=16), g 06:00–07:00: logged slot 13 anchors.
        expect(
          nextDropWindow({
            slots: mask(['g', '06:00', '07:00']),
            sleep: { start: '09:00', end: '11:00' },
            now: june(8, 10),
          }),
        ).toEqual({ kind: 'gap', targets: refs(T, 14, 15) });
      });

      it('a morning sleep that starts exactly at E has not started (09:10, sleep 09:00–11:00)', () => {
        // E=18, slot 18 is not below E, so sleep does not anchor; g 07:00–08:00 anchors at 15.
        expect(
          nextDropWindow({
            slots: mask(['g', '07:00', '08:00']),
            sleep: { start: '09:00', end: '11:00' },
            now: june(9, 10),
          }),
        ).toEqual({ kind: 'gap', targets: refs(T, 16, 17) });
      });

      it('a logged slot inside a not-yet-started morning sleep still anchors', () => {
        // E=18 at 09:10; g 09:30–10:00 is logged (slots 19) and anchors despite being ahead of E.
        expect(
          nextDropWindow({
            slots: mask(['g', '09:30', '10:00']),
            sleep: { start: '09:00', end: '11:00' },
            now: june(9, 10),
          }),
        ).toEqual({ kind: 'lastHour', targets: refs(T, 16, 17) });
      });

      it('started morning sleep (09:00–11:00 at 10:10) anchors only its started slots', () => {
        // E=20: slots 18,19 have started and are covered; nothing left below E -> lastHour.
        expect(
          nextDropWindow({
            slots: undefined,
            sleep: { start: '09:00', end: '11:00' },
            now: june(10, 10),
          }),
        ).toEqual({ kind: 'lastHour', targets: refs(T, 18, 19) });
      });

      it('morning sleep ending exactly at 12:00 still anchors once it has ended', () => {
        expect(
          nextDropWindow({
            slots: undefined,
            sleep: { start: '08:00', end: '12:00' },
            now: june(13, 10),
          }),
        ).toEqual({ kind: 'gap', targets: refs(T, 24, 25) });
      });

      it('a window ending after 12:00 is daytime and never anchors', () => {
        expect(
          nextDropWindow({
            slots: undefined,
            sleep: { start: '08:00', end: '12:30' },
            now: june(13, 10),
          }),
        ).toEqual({ kind: 'gap', targets: refs(T, 0, 1) });
      });
    });

    it('no sleep window (start === end) covers nothing', () => {
      expect(nextDropWindow({ slots: undefined, sleep: NO_SLEEP, now: june(9, 20) })).toEqual({
        kind: 'gap',
        targets: refs(T, 0, 1),
      });
    });

    it('00:15–00:44 with slot 0 covered by morning sleep falls back across midnight', () => {
      for (const m of [15, 30, 44]) {
        const w = nextDropWindow({ slots: undefined, sleep: NIGHT, now: june(0, m) });
        expect(w.kind).toBe('lastHour');
      }
      // 00:44 rounds to 00:30 (E=1): same as lastHour 23:30 -> 00:30.
      expect(nextDropWindow({ slots: undefined, sleep: NIGHT, now: june(0, 44) }).targets).toEqual([
        { date: Y, slot: 47 },
        { date: T, slot: 0 },
      ]);
    });

    it('00:44 uncovered slot 0 -> gap today 00:00–00:30', () => {
      expect(nextDropWindow({ slots: undefined, sleep: NO_SLEEP, now: june(0, 44) })).toEqual({
        kind: 'gap',
        targets: refs(T, 0),
      });
    });

    it('00:45 gives E=2 and a full gap hour when uncovered', () => {
      expect(nextDropWindow({ slots: undefined, sleep: NO_SLEEP, now: june(0, 45) })).toEqual({
        kind: 'gap',
        targets: refs(T, 0, 1),
      });
    });

    it('00:00–00:14 always falls back to yesterday 23:00–24:00', () => {
      for (const m of [0, 14]) {
        expect(nextDropWindow({ slots: undefined, sleep: NO_SLEEP, now: june(0, m) })).toEqual({
          kind: 'lastHour',
          targets: refs(Y, 46, 47),
        });
      }
    });

    it('ignores seconds', () => {
      const slots = mask(['g', '07:00', '09:00']);
      expect(nextDropWindow({ slots, sleep: NIGHT, now: june(10, 14, 59) })).toEqual(
        nextDropWindow({ slots, sleep: NIGHT, now: june(10, 0) }),
      );
    });

    it('gap targets are never logged or morning-sleep slots', () => {
      const slots = mask(['g', '07:00', '08:00'], ['b', '09:00', '09:30']);
      const w = nextDropWindow({ slots, sleep: NIGHT, now: june(12, 0) });
      expect(w.kind).toBe('gap');
      for (const t of w.targets) {
        expect(slots[t.slot]).toBe('.');
        expect(t.slot).toBeGreaterThanOrEqual(14);
      }
    });

    it('DST spring-forward: nonexistent slots are never the anchor', () => {
      // Sleep 02:00–03:00 is exactly the missing hour (slots 4, 5): it must not anchor,
      // so the gap still starts at 00:00.
      expect(
        nextDropWindow({
          slots: undefined,
          sleep: { start: '02:00', end: '03:00' },
          now: at(2026, 3, 8, 5, 10),
        }),
      ).toEqual({ kind: 'gap', targets: refs(DST, 0, 1) });
    });

    it('DST spring-forward: all remaining slots nonexistent -> lastHour', () => {
      // Now 03:10 (E=6), logged ..02:00 (slots 0..3). Slots 4,5 do not exist.
      expect(
        nextDropWindow({
          slots: mask(['g', '00:00', '02:00']),
          sleep: NO_SLEEP,
          now: at(2026, 3, 8, 3, 10),
        }),
      ).toEqual({ kind: 'lastHour', targets: refs(DST, 2, 3) });
    });

    it('the day after spring-forward behaves normally', () => {
      expect(
        nextDropWindow({ slots: undefined, sleep: NO_SLEEP, now: at(2026, 3, 9, 3, 10) }),
      ).toEqual({ kind: 'gap', targets: refs('2026-03-09', 0, 1) });
    });

    it('fall-back 2026-11-01 uses wall-clock slots', () => {
      expect(
        nextDropWindow({ slots: undefined, sleep: NO_SLEEP, now: at(2026, 11, 1, 2, 10) }),
      ).toEqual({ kind: 'gap', targets: refs('2026-11-01', 0, 1) });
    });
  });
});
