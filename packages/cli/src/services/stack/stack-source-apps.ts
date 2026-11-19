import fs from 'fs';
import path from 'path';
import { parse } from 'yaml';
import type { IStackSourceApp } from '@cli/services/stack/interfaces/stack-source-app.interface';

/**
 * How a Next app runs from the worktree's SOURCE, taken from the framework's own dev overlay.
 *
 * The admin and storefront images run `next start` on a `.next` baked into the image, so mounting
 * a worktree's `dist` never reaches them: on 2026-11-19 a session's new console CSS was invisible
 * in its stack, which kept serving v0.2.588's screens, and the session fell back to repointing the
 * SHARED stack at its worktree. `docker-compose.sources.yml` already states what it takes to run
 * these apps from source — the dev command, the watcher's polling, every source folder and config
 * file next.config reads — so the stack reuses that statement instead of keeping a second list.
 *
 * Its `./` paths are the framework root, and become this worktree's. A mount whose host path is
 * absent is dropped: an empty host directory would hide the image's own copy.
 */
export class StackSourceApps {
  static readonly FILE = 'docker-compose.sources.yml';

  private constructor(
    private readonly framework: string,
    private readonly services: Record<string, Record<string, unknown>>,
  ) {}

  static of(framework: string): StackSourceApps {
    const file = path.join(framework, StackSourceApps.FILE);
    if (!fs.existsSync(file)) return new StackSourceApps(framework, {});

    const document = parse(fs.readFileSync(file, 'utf8')) as { services?: Record<string, Record<string, unknown>> } | null;
    return new StackSourceApps(framework, document?.services ?? {});
  }

  /** The source run of one service, or null when the dev overlay does not describe one. */
  app(service: string): IStackSourceApp | null {
    const declared = this.services[service];
    if (!declared || !Array.isArray(declared.command)) return null;

    return {
      command: (declared.command as unknown[]).map(String),
      environment: Array.isArray(declared.environment) ? (declared.environment as unknown[]).map(String) : [],
      volumes: (Array.isArray(declared.volumes) ? (declared.volumes as unknown[]) : [])
        .map((volume) => this.resolve(String(volume)))
        .filter((volume): volume is string => volume !== null),
      memory: StackSourceApps.memoryOf(declared),
    };
  }

  /**
   * The memory limit the dev overlay sets. Without it the deploy topology's 512 MiB applies, and the
   * dev server is killed mid-compile of the first page, restarting forever behind a 502.
   */
  private static memoryOf(declared: Record<string, unknown>): string | null {
    const deploy = declared.deploy as { resources?: { limits?: { memory?: unknown } } } | undefined;
    const memory = deploy?.resources?.limits?.memory;
    return memory === undefined ? null : String(memory);
  }

  /** A `./host:container` mount made absolute against this worktree, or null when the host is absent. */
  private resolve(volume: string): string | null {
    const separator = volume.indexOf(':');
    if (separator < 0) return null;

    const host = volume.slice(0, separator);
    if (!host.startsWith('.')) return volume;

    const absolute = path.resolve(this.framework, host);
    return fs.existsSync(absolute) ? `${absolute}${volume.slice(separator)}` : null;
  }
}
