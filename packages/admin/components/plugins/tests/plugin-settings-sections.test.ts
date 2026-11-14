import { describe, expect, it } from 'vitest';
import { PluginSettingsSections } from '@/components/plugins/plugin-settings-sections';

describe('PluginSettingsSections.cardsOf', () => {
  it('groups fields by their declared section, in the order the sections first appear', () => {
    const cards = PluginSettingsSections.cardsOf([
      { name: 'a', admin: { section: 'Shop', sectionKey: 'shop' } },
      { name: 'b', admin: { section: 'Prices', sectionKey: 'prices' } },
      { name: 'c', admin: { section: 'Shop', sectionKey: 'shop' } },
    ], [{ name: 'prices', description: 'How prices are shown.' }]);

    expect(cards.map((card) => [card.key, card.title, card.fields.map((field) => field.name)])).toEqual([
      ['shop', 'Shop', ['a', 'c']],
      ['prices', 'Prices', ['b']],
    ]);
    expect(cards[0].description).toBeUndefined();
    expect(cards[1].description).toBe('How prices are shown.');
  });

  it('puts fields that name no section in one untitled card', () => {
    const cards = PluginSettingsSections.cardsOf([{ name: 'a' }, { name: 'b', admin: {} }], undefined);
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ key: '_untitled', title: undefined });
    expect(cards[0].fields).toHaveLength(2);
  });
});
