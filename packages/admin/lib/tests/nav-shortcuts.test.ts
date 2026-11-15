import { describe, expect, it } from 'vitest';
import { NavShortcuts } from '@/lib/nav-shortcuts';

/**
 * G, then a letter. The letter comes from the address, not the name, because the console is read in
 * one language and typed on a keyboard laid out in another.
 */
describe('NavShortcuts', () => {
  const menu = [
    { path: '/' },
    { path: '/orders/open' },
    { path: '/notes' },
    { path: '/ledger' },
    { path: '/reports' },
    { path: '/rota/me' },
    { path: '/gallery' },
    { path: '/people' },
  ];

  it('gives every section a letter of its own, in menu order', () => {
    const assigned = NavShortcuts.assign(menu);
    expect([...assigned.values()]).toEqual(['d', 'o', 'n', 'l', 'r', 't', 'g', 'p']);
    expect(new Set(assigned.values()).size).toBe(assigned.size);
  });

  it('takes the letter from the address, so renaming a page never moves it', () => {
    expect(NavShortcuts.assign([{ path: '/orders/open' }]).get('/orders/open')).toBe('o');
    expect(NavShortcuts.assign([{ path: '/' }]).get('/')).toBe('d');
  });

  it('answers the physical key, so a Cyrillic layout types the same sequence', () => {
    const assigned = NavShortcuts.assign(menu);
    expect(NavShortcuts.pathFor(assigned, 'KeyO')).toBe('/orders/open');
    expect(NavShortcuts.pathFor(assigned, 'KeyZ')).toBe('');
    expect(NavShortcuts.letterOf('KeyG')).toBe('g');
    expect(NavShortcuts.letterOf('Digit1')).toBe('');
  });

  it('walks the address for the next free letter when the first is spoken for', () => {
    const assigned = NavShortcuts.assign([{ path: '/alpha' }, { path: '/apples' }]);
    expect(assigned.get('/alpha')).toBe('a');
    // `apples` cannot have `a`, so it takes `p` — the next letter of its own address, never another's.
    expect(assigned.get('/apples')).toBe('p');
  });

  it('leaves a section without a letter rather than taking one that is spoken for', () => {
    const assigned = NavShortcuts.assign([{ path: '/a' }, { path: '/a-too' }]);
    expect(assigned.get('/a')).toBe('a');
    expect(assigned.has('/a-too')).toBe(true);
    expect(NavShortcuts.assign([{ path: '/a' }, { path: '/aaa' }]).has('/aaa')).toBe(false);
  });

  it('lets the page keep what is typed into it', () => {
    const field = { closest: (selector: string) => (selector.includes('input') ? {} : null) } as unknown as EventTarget;
    const plain = { closest: () => null } as unknown as EventTarget;
    expect(NavShortcuts.isTyping(field, {})).toBe(true);
    expect(NavShortcuts.isTyping(plain, {})).toBe(false);
    expect(NavShortcuts.isTyping(plain, { metaKey: true })).toBe(true);
  });
});
