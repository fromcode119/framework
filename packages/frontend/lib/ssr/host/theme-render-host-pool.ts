import { ThemeRenderHost } from '@/lib/ssr/host/theme-render-host';
import { ThemeRenderSettings } from '@/lib/ssr/host/theme-render-settings';
import { ThemeSsrGeneration } from '@/lib/ssr/theme-ssr-generation';
import { ThemeSsrMarkup } from '@/lib/ssr/theme-ssr-markup';
import type { IThemeRenderBoot } from '@/lib/ssr/host/interfaces/theme-render-boot.interface';
import type { IThemeRenderRequest } from '@/lib/ssr/host/interfaces/theme-render-request.interface';

/**
 * The resident render hosts, one per generation signature, least-recently-used above the cap.
 *
 * The cap (`ssr_generation_cap`) used to bound registries in one process; it now bounds PROCESSES,
 * which is the stronger reason for it to exist. Sites on the same theme and plugin set share one
 * host, so residency is bounded by distinct signatures, not by tenants. A host that died is replaced
 * on the next request for its signature; a request for a signature this pool has never built waits
 * for that build and nothing else — builds of different generations no longer serialize, because
 * each has its own process and its own staging state.
 */
export class ThemeRenderHostPool {
  private static hosts = new Map<string, Promise<ThemeRenderHost | null>>();

  /** Signatures in least-recently-used order (front = oldest). */
  private static recency: string[] = [];

  static async render(args: {
    generation: ThemeSsrGeneration;
    settings: ThemeRenderSettings;
    frontendDir: string;
    boot: IThemeRenderBoot;
    request: IThemeRenderRequest;
  }): Promise<ThemeSsrMarkup | null> {
    const { generation, settings, frontendDir, boot, request } = args;
    const key = generation.signature;
    ThemeRenderHostPool.touch(key);
    let pending = ThemeRenderHostPool.hosts.get(key);
    let host = pending ? await pending : null;
    if (host && !host.isAlive) {
      ThemeRenderHostPool.hosts.delete(key);
      pending = undefined;
    }
    if (!pending) {
      pending = ThemeRenderHostPool.start(generation, settings, frontendDir, boot);
      ThemeRenderHostPool.hosts.set(key, pending);
      ThemeRenderHostPool.evictAbove(settings.generationCap, key);
      host = await pending;
    }
    if (!host) return null;
    const parts = await host.render(request);
    return parts ? ThemeSsrMarkup.fromParts(parts) : null;
  }

  private static async start(generation: ThemeSsrGeneration, settings: ThemeRenderSettings, frontendDir: string, boot: IThemeRenderBoot): Promise<ThemeRenderHost | null> {
    const host = new ThemeRenderHost(generation, settings, frontendDir);
    try {
      if (await host.start(boot)) return host;
    } catch (error) {
      console.warn(`[frontend] render host for ${generation.signature} could not start: ${error instanceof Error ? error.message : String(error)}`);
      host.stop();
    }
    // Forget the failed build so the next request for this signature retries rather than caching null.
    ThemeRenderHostPool.hosts.delete(generation.signature);
    return null;
  }

  private static touch(signature: string): void {
    ThemeRenderHostPool.recency = ThemeRenderHostPool.recency.filter((entry) => entry !== signature);
    ThemeRenderHostPool.recency.push(signature);
  }

  /** Drops the least-recently-used hosts above the cap — never the one just requested — and kills their processes. */
  private static evictAbove(cap: number, keep: string): void {
    while (ThemeRenderHostPool.recency.length > cap) {
      const victim = ThemeRenderHostPool.recency.find((entry) => entry !== keep);
      if (!victim) return;
      ThemeRenderHostPool.recency = ThemeRenderHostPool.recency.filter((entry) => entry !== victim);
      const pending = ThemeRenderHostPool.hosts.get(victim);
      ThemeRenderHostPool.hosts.delete(victim);
      void pending?.then((host) => host?.stop());
      console.info(`[frontend] SSR render host evicted (cap ${cap}): ${victim}`);
    }
  }
}
