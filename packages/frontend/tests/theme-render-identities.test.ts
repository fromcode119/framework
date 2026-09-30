import { describe, expect, it } from 'vitest';
import { SystemConstants } from '@fromcode119/core/client';
import { ThemeRenderIdentities } from '@/lib/ssr/host/theme-render-identities';

/**
 * Every render host used to run as ONE uid, so each was the same user as all the others — able to
 * signal them and to enter the spawner directories whose only guard is a different user.
 */
describe('the user a render host runs as', () => {
  const base = SystemConstants.PROCESS_ISOLATION.THEME_UID;

  it('is its own per signature, stable while resident, inside the theme range', () => {
    const a = ThemeRenderIdentities.uidFor('sig-a');
    const b = ThemeRenderIdentities.uidFor('sig-b');
    expect(a).not.toBe(b);
    expect(ThemeRenderIdentities.uidFor('sig-a')).toBe(a);
    for (const uid of [a, b]) {
      expect(uid).toBeGreaterThanOrEqual(base);
      expect(uid).toBeLessThan(base + ThemeRenderIdentities.SIZE);
    }
    ThemeRenderIdentities.release('sig-a');
    ThemeRenderIdentities.release('sig-b');
  });

  it('does not hand a just-freed uid straight to the next host', () => {
    const first = ThemeRenderIdentities.uidFor('sig-c');
    ThemeRenderIdentities.release('sig-c');
    expect(ThemeRenderIdentities.uidFor('sig-d')).not.toBe(first);
    ThemeRenderIdentities.release('sig-d');
  });
});
