import { describe, expect, it } from 'vitest';
import { RowWindow } from '@database/dialects/row-window';

/**
 * LIMIT / OFFSET are written into raw find statements as text, and the values come from plugin code —
 * for an isolated plugin, from another process. Only a whole number may reach the SQL.
 */
describe('RowWindow.clause', () => {
  it('writes what callers already passed exactly as before', () => {
    expect(RowWindow.clause(20, undefined)).toBe(' LIMIT 20');
    expect(RowWindow.clause('20', '40')).toBe(' LIMIT 20 OFFSET 40');
    expect(RowWindow.clause(undefined, 10)).toBe(' OFFSET 10');
    expect(RowWindow.clause(0, 0)).toBe('');
    expect(RowWindow.clause(null, '')).toBe('');
    expect(RowWindow.clause(12.9, 3.2)).toBe(' LIMIT 12 OFFSET 3');
  });

  it.each([
    ['1 UNION SELECT password_hash FROM users'],
    ['20; DROP TABLE x'],
    ['1e3'],
    ['-5'],
    [-5],
    [Number.NaN],
    [Number.POSITIVE_INFINITY],
    [{ toString: () => '5' }],
    [[5]],
    [true],
  ])('refuses %j instead of writing it into the statement', (value) => {
    expect(() => RowWindow.clause(value, undefined)).toThrow(/Invalid limit/);
    expect(() => RowWindow.clause(undefined, value)).toThrow(/Invalid offset/);
  });
});
