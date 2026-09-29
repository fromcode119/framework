import { describe, expect, it } from 'vitest';
import { SidebarLanguageItems } from '@/app/components/view/sidebar-language-items';

/** The account menu's Language group: the site default first, then every enabled language, one selected. */
describe('SidebarLanguageItems', () => {
  const locales = [{ code: 'en', label: 'English' }, { code: 'bg', label: 'Български' }];

  it('marks the site default as chosen when the reader has not picked a language', () => {
    const items = SidebarLanguageItems.build({ personal: '', defaultLocale: 'en', locales });
    expect(items.map((item) => [item.label, item.selected])).toEqual([
      ['Site default (English)', true], ['English', false], ['Български', false],
    ]);
    expect(items[0]!.section).toBe('Language');
    expect(items.slice(1).every((item) => item.section === undefined)).toBe(true);
  });

  it("marks the reader's own language", () => {
    const items = SidebarLanguageItems.build({ personal: 'bg', defaultLocale: 'en', locales });
    expect(items.filter((item) => item.selected).map((item) => item.label)).toEqual(['Български']);
  });

  it('offers nothing when the site has only one language', () => {
    expect(SidebarLanguageItems.build({ personal: '', defaultLocale: 'en', locales: [locales[0]!] })).toEqual([]);
  });
});
