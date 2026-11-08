import { describe, expect, it } from 'vitest';
import { ThemeCssVariable } from '@core/theme/theme-css-variable';

describe('ThemeCssVariable.propertyFor', () => {
  it('kebab-cases a plain key under --theme-', () => {
    expect(ThemeCssVariable.propertyFor('primaryColor')).toBe('--theme-primary-color');
  });
  it('keeps a key that is already a custom property', () => {
    expect(ThemeCssVariable.propertyFor('--tps-color-pink')).toBe('--tps-color-pink');
  });
});
