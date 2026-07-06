/** Unit tests for pure date helpers used across the app. */
import { addDays, weekDays, weekStart } from '../src/utils/date';

describe('date utils', () => {
  it('weekStart returns the Monday of the week', () => {
    // 2026-07-06 is a Monday
    expect(weekStart('2026-07-06')).toBe('2026-07-06');
    // 2026-07-08 (Wed) -> Monday 2026-07-06
    expect(weekStart('2026-07-08')).toBe('2026-07-06');
    // 2026-07-05 (Sun) -> previous Monday 2026-06-29
    expect(weekStart('2026-07-05')).toBe('2026-06-29');
  });

  it('addDays shifts across month boundaries', () => {
    expect(addDays('2026-07-31', 1)).toBe('2026-08-01');
    expect(addDays('2026-08-01', -1)).toBe('2026-07-31');
  });

  it('weekDays returns 7 consecutive days', () => {
    const days = weekDays('2026-07-06');
    expect(days).toHaveLength(7);
    expect(days[0]).toBe('2026-07-06');
    expect(days[6]).toBe('2026-07-12');
  });
});
