import fs from 'fs';
import os from 'os';
import path from 'path';
import { RemoteShell } from '@cli/services/deploy/remote-shell';
import type { IStackManifest } from '@cli/services/stack/interfaces/stack-manifest.interface';

/**
 * The packages a worktree needs that the image under its stack does not have.
 *
 * A stack runs a released image already on the machine and mounts the worktree's built packages over
 * it, and that image is usually many releases behind. When a release since then added a dependency,
 * the mounted code imports a package the image never installed: the console answered 500 with "Cannot
 * find module" on 2026-11-21 (`@zxing/browser`), and on 2026-11-24 the api crashed on start because
 * core had gained `pkijs`. Nothing in the worktree shows it, because its own `node_modules` is not the
 * one the container resolves from.
 *
 * So for every service that runs the mounted code, the stack takes what its app declares AND what every
 * workspace package it uses declares, asks the image which of those it lacks, installs exactly those in a
 * one-off container of the same image (so a native module is built for that image), and copies them into
 * the service — which works even while the service is crashing for want of them — then restarts it.
 */
export class StackImagePackages {
  /** The services that run the mounted code, and the workspace package each starts from. */
  private static readonly SERVICES: Record<string, string> = {
    admin: 'admin', frontend: 'frontend', api: 'api', 'extension-host': 'api', 'site-extension-host': 'api', gateway: 'cli', edge: 'cli', updater: 'cli',
  };
  private static readonly SCOPE = '@fromcode119/';

  /** What `workspace` and every workspace package it uses ask for from the registry, as `name@range`. */
  static declaredBy(framework: string, workspace: string): string[] {
    const specs = [...StackImagePackages.closureOf(framework, workspace).values()].flatMap((manifest) =>
      Object.entries(manifest.dependencies ?? {})
        .filter(([name, range]) => !name.startsWith(StackImagePackages.SCOPE) && !/^(workspace|file|link):/.test(range))
        .map(([name, range]) => `${name}@${range}`),
    );
    return [...new Set(specs)];
  }

  /**
   * The folders an image may keep one declared package in: the root, or beside each workspace package
   * that declares it. A version that could not be hoisted stays in the workspace's own folder, and
   * looking only at the root reinstalled those into every stack, on an image that already had them.
   */
  static foldersOf(framework: string, workspace: string, spec: string): string[] {
    const name = StackImagePackages.nameOf(spec);
    const declarers = [...StackImagePackages.closureOf(framework, workspace)].filter(([, manifest]) => manifest.dependencies?.[name] !== undefined);
    return ['/app/node_modules', ...declarers.map(([declarer]) => `/app/packages/${declarer}/node_modules`)].map((folder) => `${folder}/${name}`);
  }

  /** `workspace` and every workspace package it uses, with each one's manifest. */
  private static closureOf(framework: string, workspace: string, found = new Map<string, IStackManifest>()): Map<string, IStackManifest> {
    const file = path.join(framework, 'packages', workspace, 'package.json');
    if (found.has(workspace) || !fs.existsSync(file)) return found;

    const manifest = JSON.parse(fs.readFileSync(file, 'utf8')) as IStackManifest;
    found.set(workspace, manifest);
    for (const name of Object.keys(manifest.dependencies ?? {})) {
      if (name.startsWith(StackImagePackages.SCOPE)) StackImagePackages.closureOf(framework, name.slice(StackImagePackages.SCOPE.length), found);
    }
    return found;
  }

  /** The declared packages whose folder the image does not have. */
  static missing(declared: string[], present: Set<string>): string[] {
    return declared.filter((spec) => !present.has(StackImagePackages.nameOf(spec)));
  }

  /** `@scope/name@^1` → `@scope/name`. */
  static nameOf(spec: string): string {
    const at = spec.lastIndexOf('@');
    return at > 0 ? spec.slice(0, at) : spec;
  }

  constructor(private readonly framework: string, private readonly shell: RemoteShell) {}

  /** Installs what each running service lacks and restarts it; returns what was installed, per service. */
  async sync(): Promise<Record<string, string[]>> {
    const installed: Record<string, string[]> = {};
    const images = await this.images();
    const built = new Map<string, string>();
    try {
      for (const [service, workspace] of Object.entries(StackImagePackages.SERVICES)) {
        const image = images[service];
        if (!image) continue;
        const declared = StackImagePackages.declaredBy(this.framework, workspace);
        if (!declared.length) continue;
        const lacking = StackImagePackages.missing(declared, await this.presentIn(image, workspace, declared));
        if (!lacking.length) continue;
        const key = `${image} ${lacking.join(' ')}`;
        if (!built.has(key)) built.set(key, await this.install(image, lacking));
        const container = (await this.shell.runOrThrow(`docker compose ps -a -q ${service}`)).trim();
        if (!container) continue;
        await this.shell.runOrThrow(`docker cp "${path.join(built.get(key)!, 'node_modules')}/." ${container}:/app/node_modules/`);
        await this.shell.runOrThrow(`docker compose restart ${service}`);
        installed[service] = lacking;
      }
    } finally {
      for (const out of built.values()) fs.rmSync(out, { recursive: true, force: true });
    }
    return installed;
  }

  /** The image each service of the stack runs, by service name. */
  private async images(): Promise<Record<string, string>> {
    const config = JSON.parse(await this.shell.runOrThrow('docker compose config --format json')) as { services?: Record<string, { image?: string }> };
    return Object.fromEntries(Object.entries(config.services ?? {}).filter(([, spec]) => spec.image).map(([name, spec]) => [name, String(spec.image)]));
  }

  /**
   * Asked of the image in a container of its own: a crashing service cannot be asked, and a stack's
   * services may sit on an internal network with no way to the registry.
   */
  private async presentIn(image: string, workspace: string, declared: string[]): Promise<Set<string>> {
    const probe = declared
      .map((spec) => {
        const found = StackImagePackages.foldersOf(this.framework, workspace, spec).map((folder) => `[ -d ${folder} ]`).join(' || ');
        return `{ ${found}; } && echo ${StackImagePackages.nameOf(spec)}`;
      })
      .join('; ');
    const result = await this.shell.run(`docker run --rm ${await this.platformOf(image)} --entrypoint sh ${image} -c "${probe}; true"`);
    return new Set(result.stdout.split('\n').map((line) => line.trim()).filter(Boolean));
  }

  /** Installs `lacking` with the image's own node and npm, so a native module is built for it; returns the folder. */
  private async install(image: string, lacking: string[]): Promise<string> {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'fromcode-stack-packages-'));
    const specs = lacking.map((spec) => `'${spec}'`).join(' ');
    const built = await this.shell.run(`docker run --rm ${await this.platformOf(image)} -v "${out}:/out" --entrypoint sh ${image} -c "cd /out && npm install --no-save --no-package-lock --ignore-scripts --no-audit --no-fund ${specs}"`);
    if (built.code !== 0) {
      fs.rmSync(out, { recursive: true, force: true });
      throw new Error(`Could not install ${lacking.join(', ')} with ${image}: ${built.stderr.trim()}`);
    }
    return out;
  }

  /** `--platform os/arch` of a local image, so an image built for another machine runs as itself. */
  private async platformOf(image: string): Promise<string> {
    const platform = (await this.shell.run(`docker image inspect --format "{{.Os}}/{{.Architecture}}" ${image}`)).stdout.trim();
    return platform ? `--platform ${platform}` : '';
  }
}
