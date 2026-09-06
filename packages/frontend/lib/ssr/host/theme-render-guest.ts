import { PluginChannel } from '@fromcode119/core/process';
import type { IMessagePort } from '@fromcode119/core/process';
import { ThemeSsrGeneration } from '@/lib/ssr/theme-ssr-generation';
import { ThemeSsrRuntime } from '@/lib/ssr/theme-ssr-runtime';
import { ThemeWorldBuilder } from '@/lib/ssr/theme-world-builder';
import { ThemeWorldRenderer } from '@/lib/ssr/theme-world-renderer';
import type { IThemeRenderBoot } from '@/lib/ssr/host/interfaces/theme-render-boot.interface';
import type { IThemeRenderRequest } from '@/lib/ssr/host/interfaces/theme-render-request.interface';
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
      case 'render': return this.render(payload as IThemeRenderRequest);
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

  private render(request: IThemeRenderRequest): IThemeSsrMarkupParts | null {
    if (!this.runtime || !this.generation) throw new Error('render-guest: render before boot');
    const markup = ThemeWorldRenderer.render({
      runtime: this.runtime,
      signature: this.generation.signature,
      themeSlug: this.generation.themeSlug,
      ...request,
    });
    return markup ? markup.toParts() : null;
  }
}
