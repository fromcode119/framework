import { LucideLazyLoader } from '@fromcode119/react/icons/lucide-lazy-loader';

/**
 * Loads every Lucide icon the server markup DRAWS before `hydrateRoot`, so the hydrating render draws it too.
 *
 * In the browser a plugin's `lucide-react` import is the runtime's lazy namespace: an icon renders
 * nothing until its data module lands. On the server the same import is the real package, so the markup
 * already holds the `<svg>`. Hydrating before the icon arrived is a mismatch (React #418) and the whole
 * page drops to the fallback path. Measured on a contact page: the forms plugin's TikTok icon (`music-2`),
 * which no eagerly-registered icon provider covered.
 *
 * The markup names its icons itself: lucide stamps `lucide-<key>` on every svg it renders, where `<key>`
 * is the icon's own kebab key (`lucide-music-2`). Only classes that ARE icon keys are loaded.
 *
 * Bounded like `OverrideLoaderWarmup`: an icon that never arrives must not hold the page hostage — after
 * the cap hydration goes ahead and React's recovery takes over for that one mismatch, exactly as before.
 */
export class LucideIconWarmup {
  static readonly TIMEOUT_MS = 3000;

  private static readonly CLASS_PREFIX = 'lucide-';

  /** The icon keys the markup under `host` draws. */
  static iconKeys(host: ParentNode | null): string[] {
    if (!host) return [];
    const keys = new Set<string>();
    host.querySelectorAll('svg.lucide').forEach((svg) => {
      svg.classList.forEach((token) => {
        if (!token.startsWith(LucideIconWarmup.CLASS_PREFIX)) return;
        const key = token.slice(LucideIconWarmup.CLASS_PREFIX.length);
        if (LucideLazyLoader.isIconKey(key)) keys.add(key);
      });
    });
    return Array.from(keys).sort();
  }

  /** Returns the keys it waited for (all of them, unless the cap fired first). */
  static async warm(host: ParentNode | null, timeoutMs = LucideIconWarmup.TIMEOUT_MS): Promise<string[]> {
    const keys = LucideIconWarmup.iconKeys(host);
    if (!keys.length) return keys;
    const cap = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs));
    await Promise.race([LucideLazyLoader.preload(keys), cap]);
    return keys;
  }
}
