import { ThemeRenderHost } from '@/lib/ssr/host/theme-render-host';
import { ThemeRenderIdentities } from '@/lib/ssr/host/theme-render-identities';
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

  /**
   * The signature each site renders with now. An extension update gives a site a new signature; the
   * world it leaves behind used to stay resident until the cap pushed it out, so a few updates filled
   * the storefront with superseded processes — five generations of one site at once, at the memory limit.
   */
  private static siteSignatures = new Map<string, string>();

  /** The order signatures were first built in: a site only moves FORWARD, to a newer world. */
  private static births = new Map<string, number>();
  private static born = 0;

  static async render(args: {
    generation: ThemeSsrGeneration;
    settings: ThemeRenderSettings;
    frontendDir: string;
    boot: IThemeRenderBoot;
    request: IThemeRenderRequest;
    /** The site this page belongs to — what ties a new generation to the one it supersedes. */
    siteId: string;
  }): Promise<ThemeSsrMarkup | null> {
    const { generation, settings, frontendDir, boot, request, siteId } = args;
    const key = generation.signature;
    // A request still carrying the config from before an update must not bring the world it replaced
    // back to life; that one page renders client-side, as any server-render miss does.
    if (ThemeRenderHostPool.superseded(siteId, key)) return null;
    ThemeRenderHostPool.touch(key);
    let pending = ThemeRenderHostPool.hosts.get(key);
    let host = pending ? await pending : null;
    if (host && !host.isAlive) {
      ThemeRenderHostPool.hosts.delete(key);
      pending = undefined;
    }
    if (!pending) {
      if (!ThemeRenderHostPool.births.has(key)) ThemeRenderHostPool.births.set(key, ++ThemeRenderHostPool.born);
      pending = ThemeRenderHostPool.start(generation, settings, frontendDir, boot);
      ThemeRenderHostPool.hosts.set(key, pending);
      ThemeRenderHostPool.evictAbove(settings.generationCap, key);
      host = await pending;
    }
    if (!host) return null;
    ThemeRenderHostPool.moveSite(siteId, key);
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
    ThemeRenderIdentities.release(generation.signature);
    return null;
  }

  /** Whether the site already moved on from this signature to one built after it. */
  private static superseded(siteId: string, signature: string): boolean {
    const current = siteId ? ThemeRenderHostPool.siteSignatures.get(siteId) : undefined;
    const born = ThemeRenderHostPool.births.get(signature);
    // A signature never built before is newer than anything the site renders with now.
    if (!current || current === signature || born === undefined) return false;
    return born < (ThemeRenderHostPool.births.get(current) ?? 0);
  }

  /** Records the site's current signature; the one it left is retired once no site renders with it. */
  private static moveSite(siteId: string, signature: string): void {
    if (!siteId) return;
    const previous = ThemeRenderHostPool.siteSignatures.get(siteId);
    ThemeRenderHostPool.siteSignatures.set(siteId, signature);
    if (!previous || previous === signature) return;
    if ([...ThemeRenderHostPool.siteSignatures.values()].includes(previous)) return;
    ThemeRenderHostPool.recency = ThemeRenderHostPool.recency.filter((entry) => entry !== previous);
    const pending = ThemeRenderHostPool.hosts.get(previous);
    ThemeRenderHostPool.hosts.delete(previous);
    void pending?.then((host) => host?.retire());
    ThemeRenderIdentities.release(previous);
    console.info(`[frontend] SSR render host superseded for site ${siteId}: ${previous}`);
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
      ThemeRenderIdentities.release(victim);
      console.info(`[frontend] SSR render host evicted (cap ${cap}): ${victim}`);
    }
  }
}
