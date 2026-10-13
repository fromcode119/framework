import { describe, it, expect, afterEach, vi } from 'vitest';
import { ColorPickerUtils } from '@/components/ui/color-picker-utils';

/**
 * The swatch beside a stored colour must show THAT colour. It painted every non-hex value black, so a
 * product whose confirmation icon is `pink` — which the storefront paints pink — showed a black swatch.
 */
describe('ColorPickerUtils.swatchColor', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('paints a hex code, with or without its #', () => {
    expect(ColorPickerUtils.swatchColor('#ec4899')).toBe('#ec4899');
    expect(ColorPickerUtils.swatchColor('fff')).toBe('#fff');
  });

  it('paints a colour name CSS accepts as that name', () => {
    vi.stubGlobal('CSS', { supports: (_p: string, v: string) => ['pink', 'rgb(1, 2, 3)'].includes(v) });
    expect(ColorPickerUtils.swatchColor('pink')).toBe('pink');
    expect(ColorPickerUtils.swatchColor('rgb(1, 2, 3)')).toBe('rgb(1, 2, 3)');
  });

  it('paints nothing for a value that is not a colour, instead of a black nobody chose', () => {
    vi.stubGlobal('CSS', { supports: () => false });
    expect(ColorPickerUtils.swatchColor('heart')).toBe('');
    expect(ColorPickerUtils.swatchColor('')).toBe('');
  });
});
