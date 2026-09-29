import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NotFoundBody } from '@react/view/not-found-body';

/**
 * The 404 body renders on the server (no `<html lang>` to read) and hydrates in the browser, so the
 * locale is handed in — otherwise the server paints English and the browser another language.
 */
describe('NotFoundBody', () => {
  it('renders in the locale it is given', () => {
    const html = renderToStaticMarkup(createElement(NotFoundBody, { locale: 'bg-BG' }));
    expect(html).toContain('Страницата не е намерена');
    expect(html).not.toContain('Page not found');
  });

  it('renders English when the locale has no dictionary', () => {
    expect(renderToStaticMarkup(createElement(NotFoundBody, { locale: 'xx' }))).toContain('Page not found');
  });
});
