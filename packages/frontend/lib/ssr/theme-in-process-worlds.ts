import { ThemeServerRegistry } from '@/lib/ssr/theme-server-registry';
import { ThemeSsrGeneration } from '@/lib/ssr/theme-ssr-generation';
import { ThemeSsrRuntime } from '@/lib/ssr/theme-ssr-runtime';
import { ThemeWorldBuilder } from '@/lib/ssr/theme-world-builder';

/**
 * Worlds built INSIDE the storefront process — the fallback when no theme render host can be started
 * (the guest bundle is not built, as in `next dev`). Every world shares this process, so a theme that
 * throws or hangs here takes the storefront with it; that is why it is the fallback and says so.
 *
 * One boot per SIGNATURE, resident together. On a multi-tenant deployment two sites on different themes
 * render in the same process, so a single world would have thrashed between them on every alternating
 * request. Keyed by the generation's signature, not by tenant: sites on the same theme and plugin set
 * share one entry, so residency is bounded by distinct signatures.
 */
export class ThemeInProcessWorlds {
  private static generations = new Map<string, Promise<ThemeSsrRuntime | null>>();

  /** Signatures in least-recently-used order (front = oldest), for eviction above the cap. */
  private static recency: string[] = [];

  /**
   * Builds are SERIALIZED. The registry's staging state and the runtime bridge are process-wide, so two
   * generations importing concurrently would interleave their registrations into one state. One build
   * at a time; a request whose generation is already building awaits that build, and a request whose
   * generation is published never waits at all.
   */
  private static buildQueue: Promise<unknown> = Promise.resolve();

  static boot(generation: ThemeSsrGeneration, cap: number, publicApiBaseUrl: string): Promise<ThemeSsrRuntime | null> {
    const key = generation.signature;
    ThemeInProcessWorlds.touch(key);
    const existing = ThemeInProcessWorlds.generations.get(key);
    if (existing) return existing;

    // Registered synchronously, before the first await, so concurrent requests for the same signature
    // share one build — and queued behind any build in progress, because the staging state is single.
    const build = ThemeInProcessWorlds.buildQueue.then(async () => {
      const runtime = await ThemeWorldBuilder.build(generation, publicApiBaseUrl);
      // Forget a failed build so the next request for this signature retries rather than caching null.
      if (!runtime) ThemeInProcessWorlds.generations.delete(key);
      return runtime;
    });
    ThemeInProcessWorlds.buildQueue = build.catch(() => undefined);
    ThemeInProcessWorlds.generations.set(key, build);
    ThemeInProcessWorlds.evictAbove(cap, key);
    return build;
  }

  private static touch(signature: string): void {
    ThemeInProcessWorlds.recency = ThemeInProcessWorlds.recency.filter((entry) => entry !== signature);
    ThemeInProcessWorlds.recency.push(signature);
  }

  /**
   * Drops the least-recently-used generations above the cap — never the one just requested. A hit after
   * eviction costs one serialized rebuild, not a broken page: the registry answers EMPTY for an evicted
   * signature only until its build republishes it.
   */
  private static evictAbove(cap: number, keep: string): void {
    while (ThemeInProcessWorlds.recency.length > cap) {
      const victim = ThemeInProcessWorlds.recency.find((entry) => entry !== keep);
      if (!victim) return;
      ThemeInProcessWorlds.recency = ThemeInProcessWorlds.recency.filter((entry) => entry !== victim);
      ThemeInProcessWorlds.generations.delete(victim);
      ThemeServerRegistry.evict(victim);
      console.info(`[frontend] SSR generation evicted (cap ${cap}): ${victim}`);
    }
  }
}
