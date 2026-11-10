import type { IContainerInspect } from '@cli/services/updater/interfaces/container-inspect.interface';
import type { IImageDefaults } from '@cli/services/updater/interfaces/image-defaults.interface';

/**
 * What a running container does differently from the body the compose files declare for it — the
 * settings `docker compose up` would recreate it for. An empty list means it already runs as declared.
 *
 * An inspected container carries its image's defaults (environment, command), so those are set aside
 * before comparing: a definition that names no command means the image's own.
 */
export class ContainerDrift {
  static differences(desired: Record<string, any>, running: IContainerInspect, image: IImageDefaults): string[] {
    const config = running.Config ?? {};
    const host = running.HostConfig ?? {};
    const want = desired.HostConfig ?? {};
    const imageEnv = new Set(image.Env ?? []);
    const differs: Array<[string, boolean]> = [
      ['image', desired.Image !== config.Image],
      ['environment', !ContainerDrift.sameSet(desired.Env ?? [], (config.Env ?? []).filter((entry: string) => !imageEnv.has(entry)))],
      ['command', !ContainerDrift.same(desired.Cmd ?? image.Cmd ?? null, config.Cmd ?? null)],
      ['entrypoint', !ContainerDrift.same(desired.Entrypoint ?? image.Entrypoint ?? null, config.Entrypoint ?? null)],
      ['memory limit', Number(want.Memory || 0) !== Number(host.Memory || 0)],
      ['logging', Boolean(want.LogConfig) && !ContainerDrift.same(want.LogConfig, { Type: host.LogConfig?.Type, Config: host.LogConfig?.Config ?? {} })],
      ['volumes', !ContainerDrift.sameSet(want.Binds ?? [], host.Binds ?? [])],
      ['ports', !ContainerDrift.same(ContainerDrift.sorted(want.PortBindings ?? {}), ContainerDrift.sorted(host.PortBindings ?? {}))],
      ['restart policy', String(want.RestartPolicy?.Name ?? '') !== String(host.RestartPolicy?.Name ?? '')],
    ];
    return differs.filter(([, changed]) => changed).map(([what]) => what);
  }

  private static same(a: unknown, b: unknown): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  private static sameSet(a: string[], b: string[]): boolean {
    return ContainerDrift.same([...new Set(a)].sort(), [...new Set(b)].sort());
  }

  private static sorted(value: Record<string, any>): Record<string, any> {
    return Object.fromEntries(Object.entries(value).sort(([x], [y]) => x.localeCompare(y)));
  }
}
