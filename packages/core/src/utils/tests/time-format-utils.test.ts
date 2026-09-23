import { describe, expect, it } from 'vitest';
import { TimeFormatUtils } from '@core/utils/time-format-utils';
import { TimeFormat } from '@core/enums/time-format.enum';

describe('TimeFormatUtils', () => {
  it("follows the site's language when set to follow it — or left blank", () => {
    expect(TimeFormatUtils.hourCycle('locale', 'bg')).toBe('h23');
    expect(TimeFormatUtils.hourCycle('', 'bg')).toBe('h23');
    expect(TimeFormatUtils.hourCycle(undefined, 'en-US')).toBe('h12');
  });

  it('forces a clock regardless of language', () => {
    expect(TimeFormatUtils.hourCycle('h12', 'bg')).toBe('h12');
    expect(TimeFormatUtils.hourCycle('h24', 'en-US')).toBe('h23');
  });

  it('reads an unknown language as the 24-hour ISO clock', () => {
    expect(TimeFormatUtils.languageUses12Hour('')).toBe(false);
    expect(TimeFormatUtils.languageUses12Hour('not a locale!')).toBe(false);
  });

  it('resolves stored values, defaulting to "follow the language"', () => {
    expect(TimeFormat.resolve('H24')).toBe(TimeFormat.H24);
    expect(TimeFormat.resolve('whatever')).toBe(TimeFormat.LOCALE);
  });
});
