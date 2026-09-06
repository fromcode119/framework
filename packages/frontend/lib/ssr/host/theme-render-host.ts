import { existsSync } from 'node:fs';
import path from 'node:path';
import { SystemConstants } from '@fromcode119/core/client';
import { GuestProcessLaunchers, PluginChannel } from '@fromcode119/core/process';
import type { IGuestProcess } from '@fromcode119/core/process';
import { ThemeRenderSettings } from '@/lib/ssr/host/theme-render-settings';
import { ThemeSsrGeneration } from '@/lib/ssr/theme-ssr-generation';
import type { IThemeRenderBoot } from '@/lib/ssr/host/interfaces/theme-render-boot.interface';
import type { IThemeRenderRequest } from '@/lib/ssr/host/interfaces/theme-render-request.interface';
import type { IThemeSsrMarkupParts } from '@/lib/ssr/interfaces/theme-ssr-markup-parts.interface';

/**
 * One server-render world in its own process (T5b).
 *
 * The process is started with an empty environment — the storefront's `INTERNAL_SERVICE_SECRET` is
 * not in it — a heap ceiling, and, where the deployment has a privileged spawner, as the theme user.
 * It builds exactly one generation at boot and renders pages for it on request; a theme that throws,
 * hangs or leaks takes this process down, the request that hit it gets `null` (the page renders
 * client-side, as every SSR failure always has), and the next request starts a fresh one.
 */
export class ThemeRenderHost {
  private static readonly BOOT_TIMEOUT_MS = 120_000;
  static readonly GUEST_MAIN = path.join('dist-host', 'theme-render-guest-main.cjs');

  private guest: IGuestProcess | null = null;
  private channel: PluginChannel | null = null;
  private alive = false;

  constructor(readonly generation: ThemeSsrGeneration, private readonly settings: ThemeRenderSettings, private readonly frontendDir: string) {}

  /** Whether this deployment shipped the guest bundle; without it worlds render in-process. */
  static available(frontendDir: string): boolean {
    return existsSync(path.join(frontendDir, ThemeRenderHost.GUEST_MAIN));
  }

  get isAlive(): boolean {
    return this.alive && !!this.channel && !this.channel.isClosed;
  }

  /** Starts the process and has it build the world. False when the theme registered nothing (no SSR for it). */
  async start(boot: IThemeRenderBoot): Promise<boolean> {
    const launcher = GuestProcessLaunchers.current();
    const label = `render-host:${this.generation.themeSlug}`;
    const identity = { uid: SystemConstants.PROCESS_ISOLATION.THEME_UID, gid: SystemConstants.PROCESS_ISOLATION.THEME_UID };
    const guest = await launcher.launch({
      id: `theme-${this.generation.token}`,
      entryPath: path.join(this.frontendDir, ThemeRenderHost.GUEST_MAIN),
      args: [],
      cwd: this.frontendDir,
      execArgv: [`--max-old-space-size=${this.settings.memoryMb}`],
      identity,
      writableDirs: [],
    });
    this.guest = guest;
    this.channel = new PluginChannel(guest.port);
    guest.onOutput((stream, line) => (stream === 'stderr' ? console.warn(`[${label}] ${line}`) : console.info(`[${label}] ${line}`)));
    guest.onExit((code, signal) => {
      if (this.guest !== guest) return;
      this.alive = false;
      this.channel?.close(new Error(`render host exited (${signal ?? code})`));
      console.warn(`[${label}] process ${guest.pid} exited (${signal ?? code}); the next request starts a new one.`);
    });

    const result = await this.channel.request<{ ready: boolean }>('boot', boot, ThemeRenderHost.BOOT_TIMEOUT_MS);
    if (!result?.ready) {
      this.stop();
      return false;
    }
    this.alive = true;
    const who = launcher.isolatesIdentity ? `, uid ${identity.uid}` : '';
    console.info(`[${label}] process ${guest.pid} serves ${this.generation.signature} (heap ${this.settings.memoryMb} MB, deadline ${this.settings.timeoutMs} ms${who})`);
    return true;
  }

  /** One page. A render that misses the deadline kills the process: a hung theme must not hold a request open. */
  async render(request: IThemeRenderRequest): Promise<IThemeSsrMarkupParts | null> {
    if (!this.channel || !this.isAlive) return null;
    try {
      return await this.channel.request<IThemeSsrMarkupParts | null>('render', request, this.settings.timeoutMs);
    } catch (error) {
      console.warn(`[render-host:${this.generation.themeSlug}] render failed: ${error instanceof Error ? error.message : String(error)}`);
      this.stop();
      return null;
    }
  }

  stop(): void {
    this.alive = false;
    this.guest?.kill('SIGKILL');
    this.guest = null;
    this.channel?.close();
    this.channel = null;
  }
}
