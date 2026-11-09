import { describe, expect, it } from 'vitest';
import { AccountOverviewContent } from '@react/account/overview-content';

/** A stat tile opens a section; when the shop switched that section off, the tile must not lead nowhere. */
describe('account overview stat tiles follow the offered sections', () => {
  const offered = (stats: any[], sections: string[]) => {
    const view: any = Object.create(AccountOverviewContent.prototype);
    Object.defineProperty(view, 'sections', { value: sections.map((key) => ({ key })) });
    Object.defineProperty(view, 'stats', { value: stats });
    return view.offeredStats().map((stat: any) => stat.key);
  };

  it('drops a tile whose section is not in the menu', () => {
    expect(offered([{ key: 'orders', sectionKey: 'orders' }, { key: 'wishlist', sectionKey: 'wishlist' }], ['overview', 'orders'])).toEqual(['orders']);
  });

  it('keeps a tile with its own link or with no section', () => {
    expect(offered([{ key: 'a', href: '/x', sectionKey: 'gone' }, { key: 'b' }], ['overview'])).toEqual(['a', 'b']);
  });
});
