import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ThemeComponent } from '@react/theme-runtime/theme-component';
import { ThemeRuntimeContext } from '@react/theme-runtime/theme-runtime-context';
import type { IThemeRuntimeValue } from '@react/theme-runtime/interfaces/theme-runtime-value.interface';

/** Shows what a theme component can read: a word, and one of the operator's theme settings. */
class Probe extends ThemeComponent {
  render(): ReactNode {
    return createElement('p', null, `${this.t('probe.title', 'Fallback')}|${String(this.themeVariables.siteName ?? '')}|${this.runtime.locale}`);
  }
}

const runtime = (overrides: Partial<IThemeRuntimeValue>): IThemeRuntimeValue => ({
  settings: null, globalSettings: {}, plugins: null, fromcode: {}, locale: 'bg', t: (key) => key, ...overrides,
});

const inProvider = (value: IThemeRuntimeValue) => createElement(ThemeRuntimeContext.Context.raw.Provider, { value }, createElement(Probe));

/** A theme component runs in the site (with a provider) and in the admin's block preview (without one). */
describe('ThemeComponent', () => {
  it('renders without a provider, on the stub runtime: the fallback word, no settings, English', () => {
    expect(renderToStaticMarkup(createElement(Probe))).toBe('<p>Fallback||en</p>');
  });

  it('uses the translation when the runtime has one, and the fallback when it answers with the key', () => {
    expect(renderToStaticMarkup(inProvider(runtime({ t: (key) => (key === 'probe.title' ? 'Заглавие' : key) })))).toContain('Заглавие|');
    expect(renderToStaticMarkup(inProvider(runtime({ t: (key) => key })))).toContain('Fallback|');
  });

  it('reads the operator\'s theme settings from the active theme, and the locale from the runtime', () => {
    const html = renderToStaticMarkup(inProvider(runtime({ plugins: { activeTheme: { variables: { siteName: 'My Shop' } } } })));
    expect(html).toBe('<p>Fallback|My Shop|bg</p>');
  });

  it('treats a malformed theme settings value as no settings', () => {
    expect(renderToStaticMarkup(inProvider(runtime({ plugins: { activeTheme: { variables: 'oops' } } })))).toBe('<p>Fallback||bg</p>');
  });
});
