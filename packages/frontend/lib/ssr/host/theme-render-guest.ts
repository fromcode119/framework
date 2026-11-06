import { PluginChannel } from '@fromcode119/core/process';
import type { IMessagePort } from '@fromcode119/core/process';
import { ThemeSsrGeneration } from '@/lib/ssr/theme-ssr-generation';
import { ThemeSsrRuntime } from '@/lib/ssr/theme-ssr-runtime';
import { ThemeWorldBuilder } from '@/lib/ssr/theme-world-builder';
import { ThemeWorldRenderer } from '@/lib/ssr/theme-world-renderer';
import type { IThemeRenderBoot } from '@/lib/ssr/host/interfaces/theme-render-boot.interface';
import type { IThemeRenderWireRequest } from '@/lib/ssr/host/interfaces/theme-render-wire-request.interface';
import type { IThemeSsrMarkupParts } from '@/lib/ssr/interfaces/theme-ssr-markup-parts.interface';

/**
 * The render host's side: builds ONE world at boot and renders pages for it until told to stop.
 *
 * The two directory paths arrive in the boot message and are placed into this process's (otherwise
 * empty) environment because `ThemeSsrRuntime` reads them from there — the same code the storefront
 * runs in-process, unchanged.
 */
export class ThemeRenderGuest {
  private readonly channel: PluginChannel;
  private runtime: ThemeSsrRuntime | null = null;
  private generation: ThemeSsrGeneration | null = null;

  constructor(port: IMessagePort) {
    this.channel = new PluginChannel(port);
    this.channel.serve((type, payload) => this.handle(type, payload));
  }

  private async handle(type: string, payload: any): Promise<unknown> {
    switch (type) {
      case 'boot': return this.boot(payload as IThemeRenderBoot);
      case 'render': return this.render(payload as IThemeRenderWireRequest);
      case 'ping': return 'pong';
      case 'stop': setImmediate(() => process.exit(0)); return true;
      default: throw new Error(`render-guest: unknown message "${type}"`);
    }
  }

  private async boot(boot: IThemeRenderBoot): Promise<{ ready: boolean; signature: string }> {
    process.env.THEMES_DIR = boot.themesDir;
    process.env.PLUGINS_DIR = boot.pluginsDir;
    process.chdir(boot.frontendDir);
    this.generation = ThemeSsrGeneration.from(boot.config);
    this.runtime = this.generation.themeSlug ? await ThemeWorldBuilder.build(this.generation, boot.publicApiBaseUrl) : null;
    return { ready: this.runtime !== null, signature: this.generation.signature };
  }

  /** The config and dictionaries sent so far, by fingerprint; least recently used first out. */
  private readonly kept = new Map<string, Record<string, unknown>>();
  private static readonly KEPT_MAX = 16;

  private take(ref: string, value: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
    if (value) this.kept.set(ref, value);
    const found = this.kept.get(ref);
    if (!found) return undefined;
    this.kept.delete(ref);
    this.kept.set(ref, found);
    while (this.kept.size > ThemeRenderGuest.KEPT_MAX) this.kept.delete(this.kept.keys().next().value as string);
    return found;
  }

  private render(wire: IThemeRenderWireRequest): IThemeSsrMarkupParts | { missingRef: true } | null {
    if (!this.runtime || !this.generation) throw new Error('render-guest: render before boot');
    const { refs, config: sentConfig, serverTranslations: sentTranslations, ...request } = wire;
    const config = this.take(refs.config, sentConfig);
    const serverTranslations = this.take(refs.serverTranslations, sentTranslations);
    if (!config || !serverTranslations) return { missingRef: true };
    const markup = ThemeWorldRenderer.render({
      runtime: this.runtime,
      signature: this.generation.signature,
      themeSlug: this.generation.themeSlug,
      ...request,
      config,
      serverTranslations,
    });
    return markup ? markup.toParts() : null;
  }
}
