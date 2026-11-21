import fs from 'fs';
import path from 'path';
import { RemoteShell } from '@cli/services/deploy/remote-shell';

/**
 * The packages a worktree needs that the image under its stack does not have.
 *
 * A stack runs a released image already on the machine and mounts the worktree's source over it,
 * and that image is usually many releases behind. When a release since then added a dependency,
 * the mounted source imports a package the image never installed, and the console answers 500 with
 * "Cannot find module": 2026-11-21, `@zxing/browser` (the QR scanner) on an image from 0.2.588.
 * Nothing in the worktree shows it, because its own `node_modules` is not the one the container
 * resolves from. So the stack asks the container, and installs exactly what it lacks.
 */
export class StackImagePackages {
  /** The apps that run from source in a stack, and the folder of each under the image's /app. */
  private static readonly APPS: Record<string, string> = { admin: 'packages/admin', frontend: 'packages/frontend' };

  /** What an app's package.json asks for from the registry — workspace packages come from the mount. */
  static declaredBy(framework: string, folder: string): string[] {
    const file = path.join(framework, folder, 'package.json');
    if (!fs.existsSync(file)) return [];

    const manifest = JSON.parse(fs.readFileSync(file, 'utf8')) as { dependencies?: Record<string, string> };
    return Object.entries(manifest.dependencies ?? {})
      .filter(([name, range]) => !name.startsWith('@fromcode119/') && !/^(workspace|file|link):/.test(range))
      .map(([name, range]) => `${name}@${range}`);
  }

  /** The declared packages whose folder is in neither of the two places Node looks. */
  static missing(declared: string[], present: Set<string>): string[] {
    return declared.filter((spec) => !present.has(StackImagePackages.nameOf(spec)));
  }

  /** `@scope/name@^1` → `@scope/name`. */
  static nameOf(spec: string): string {
    const at = spec.lastIndexOf('@');
    return at > 0 ? spec.slice(0, at) : spec;
  }

  constructor(private readonly framework: string, private readonly shell: RemoteShell) {}

  /** Installs what each running app lacks and restarts it; returns what was installed, per service. */
  async sync(): Promise<Record<string, string[]>> {
    const installed: Record<string, string[]> = {};

    for (const [service, folder] of Object.entries(StackImagePackages.APPS)) {
      const declared = StackImagePackages.declaredBy(this.framework, folder);
      if (!declared.length) continue;

      const present = await this.presentIn(service, folder, declared);
      const lacking = StackImagePackages.missing(declared, present);
      if (!lacking.length) continue;

      const install = await this.shell.run(
        `docker compose exec -T ${service} sh -c "cd ${folder} && npm install --no-save --ignore-scripts --no-audit --no-fund ${lacking.map((spec) => `'${spec}'`).join(' ')}"`,
      );
      if (install.code !== 0) throw new Error(`Could not install ${lacking.join(', ')} into the ${service} container: ${install.stderr.trim()}`);

      await this.shell.runOrThrow(`docker compose restart ${service}`);
      installed[service] = lacking;
    }
    return installed;
  }

  private async presentIn(service: string, folder: string, declared: string[]): Promise<Set<string>> {
    const names = declared.map((spec) => StackImagePackages.nameOf(spec));
    const probe = names.map((name) => `{ [ -d node_modules/${name} ] || [ -d ${folder}/node_modules/${name} ]; } && echo ${name}`).join('; ');
    const result = await this.shell.run(`docker compose exec -T ${service} sh -c "${probe}"`);
    return new Set(result.stdout.split('\n').map((line) => line.trim()).filter(Boolean));
  }
}
