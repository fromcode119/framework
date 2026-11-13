import { describe, it, expect } from 'vitest';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { UiFieldUtils } from '@/lib/ui';

/**
 * Every single-line field in the console is one height with one text size. A caller may add classes to
 * a field but may not resize it — that is how a 34px field ended up beside a 40px one.
 */
describe('UiFieldUtils — one field size', () => {
  const heightOf = (classes: string) => classes.split(' ').filter((token) => token.startsWith('h-'));
  const textSizeOf = (classes: string) => classes.split(' ').filter((token) => token.startsWith('text-[') && token.endsWith('px]'));

  it('gives every requested size the same box', () => {
    const md = UiFieldUtils.getFieldClasses(FieldSize.MD);
    expect(UiFieldUtils.getFieldClasses(FieldSize.SM)).toBe(md);
    expect(UiFieldUtils.getFieldClasses(FieldSize.LG)).toBe(md);
    expect(heightOf(md)).toEqual(['h-10']);
  });

  it('drops a caller height or text size meant for a line of text', () => {
    const classes = UiFieldUtils.getFieldClasses(FieldSize.MD, 'h-9 sm:h-[34px] text-[10px] text-sm ps-8');
    expect(heightOf(classes)).toEqual(['h-10']);
    expect(textSizeOf(classes)).toEqual(['text-[12px]']);
    expect(classes).toContain('ps-8');
    expect(classes).not.toContain('text-sm');
    expect(classes).not.toContain('sm:h-[34px]');
  });

  it('keeps the height of a tall box, which is not a line of text', () => {
    expect(UiFieldUtils.getFieldClasses(FieldSize.MD, 'h-64')).toContain('h-64');
    expect(UiFieldUtils.getFieldClasses(FieldSize.MD, 'min-h-[100px]')).toContain('min-h-[100px]');
  });

  it('lets a text area grow with its rows: the one-line height is not left on it', () => {
    const classes = UiFieldUtils.getFieldClasses(FieldSize.MD, 'resize-none h-auto min-h-[100px]');
    expect(heightOf(classes)).toEqual(['h-auto']);
    expect(classes).toContain('min-h-[100px]');
  });

  it('keeps a text colour, which is not a size', () => {
    expect(UiFieldUtils.getFieldClasses(FieldSize.MD, 'text-rose-600')).toContain('text-rose-600');
  });
});
