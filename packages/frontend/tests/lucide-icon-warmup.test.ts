// @vitest-environment jsdom
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { IconNode } from 'lucide-react';
import { Music2, Phone } from 'lucide-react';
import { LucideLazyLoader } from '@fromcode119/react/icons/lucide-lazy-loader';
import { LucideIconWarmup } from '@/runtime/lucide-icon-warmup';

/**
 * The regression this guards: a contact page fell off hydration (React #418) because the server drew a
 * plugin's TikTok icon and the browser's lazy lucide namespace had not loaded it yet, so the hydrating
 * render drew nothing in its place. The icons the markup draws are now loaded before `hydrateRoot`.
 */
class WarmupFixture {
  static readonly node: IconNode = [['path', { d: 'M0 0h1', key: 'k' }]];

  /** Server markup exactly as the real package renders it — what `#fc-root` holds at boot. */
  static host(): HTMLElement {
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(createElement('a', null, createElement(Music2, { size: 16 }), createElement(Phone, { size: 22 })));
    return host;
  }
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('LucideIconWarmup', () => {
  it('reads the icon keys from the classes lucide stamps on the server-rendered svg', () => {
    expect(LucideIconWarmup.iconKeys(WarmupFixture.host())).toEqual(['music-2', 'phone']);
  });

  it('ignores svgs that are not lucide icons and class tokens that are not icon keys', () => {
    const host = document.createElement('div');
    host.innerHTML = '<svg class="lucide lucide-not-a-real-icon custom"></svg><svg class="lucide-music-2"></svg>';
    expect(LucideIconWarmup.iconKeys(host)).toEqual([]);
    expect(LucideIconWarmup.iconKeys(null)).toEqual([]);
  });

  it('has every drawn icon resolvable synchronously once it settles, so hydration draws it too', async () => {
    const fetchIconNode = vi.spyOn(LucideLazyLoader, 'fetchIconNode').mockResolvedValue(WarmupFixture.node);
    expect(await LucideIconWarmup.warm(WarmupFixture.host())).toEqual(['music-2', 'phone']);
    expect(fetchIconNode.mock.calls.map(([kebab]) => kebab).sort()).toEqual(['music-2', 'phone']);
    expect(LucideLazyLoader.get('Music2')).not.toBeNull();
    expect(LucideLazyLoader.get('Phone')).not.toBeNull();
  });

  it('does not hold the page hostage when an icon never arrives', async () => {
    vi.spyOn(LucideLazyLoader, 'fetchIconNode').mockReturnValue(new Promise<IconNode>(() => undefined));
    const host = document.createElement('div');
    host.innerHTML = '<svg class="lucide lucide-anchor"></svg>';
    const started = Date.now();
    expect(await LucideIconWarmup.warm(host, 20)).toEqual(['anchor']);
    expect(Date.now() - started).toBeLessThan(1000);
  });
});
