import { describe, expect, it } from 'vitest';
import { isValidElement } from 'react';
import { AdminRichText } from '@/components/ui/view/admin-rich-text.client';

describe('AdminRichText.parts', () => {
  it('keeps text and turns the recognised tags into elements, in the sentence order given', () => {
    const parts = AdminRichText.parts('Индексира всеки хост <code>api.</code>, дори <strong>този</strong>.');
    expect(parts[0]).toBe('Индексира всеки хост ');
    expect(isValidElement(parts[1]) && (parts[1] as any).type).toBe('code');
    expect((parts[1] as any).props.children).toBe('api.');
    expect(parts[2]).toBe(', дори ');
    expect((parts[3] as any).type).toBe('strong');
    expect(parts[4]).toBe('.');
  });

  it('renders any other markup as plain text', () => {
    const parts = AdminRichText.parts('<img src=x onerror=alert(1)> and <a href="x">link</a>');
    expect(parts).toEqual(['<img src=x onerror=alert(1)> and <a href="x">link</a>']);
  });
});
