import { createRequire } from 'module';
import path from 'path';
import { SystemConstants } from '@core/constants/system.constants';
import { PrivilegeDrop } from '@core/process/privilege-drop';
import { ProcessEntry } from '@core/process/process-entry';

/**
 * Starts a Next app (admin or frontend) the way the container needs it started: as root for one
 * fork, then as the unprivileged user. `next start` cannot do that itself, so this is what the two
 * apps' `start` scripts run instead.
 *
 *   node app-launcher-main.js --app frontend [--dir <app dir>] [--port 3000] [--hostname 0.0.0.0]
 *
 * The frontend gets the privileged spawner (its theme render hosts run as their own user); the admin
 * runs no guest code and gets none. Both then start Next in this very process, so the spawner client
 * published on `globalThis` is right there for the Next-bundled render host to find.
 */
@ProcessEntry.start('app-launcher')
export class AppLauncherMain {
  static async main(argv: string[]): Promise<void> {
    const app = AppLauncherMain.flag(argv, '--app');
    if (app !== 'frontend' && app !== 'admin') throw new Error('--app must be "frontend" or "admin"');
    const dir = path.resolve(AppLauncherMain.flag(argv, '--dir') || process.cwd());
    const port = Number(AppLauncherMain.flag(argv, '--port') || process.env.PORT || 3000);
    const hostname = AppLauncherMain.flag(argv, '--hostname') || '0.0.0.0';

    await PrivilegeDrop.perform({ runAs: SystemConstants.PROCESS_ISOLATION.RUN_AS_USER, withSpawner: app === 'frontend' });

    // Next's own `start` command, resolved from the APP's directory so it is the app's Next version.
    const appRequire = createRequire(path.join(dir, 'package.json'));
    const { nextStart } = appRequire('next/dist/cli/next-start') as { nextStart: (options: { port: number; hostname: string }, directory: string) => Promise<void> };
    await nextStart({ port, hostname }, dir);
  }

  private static flag(argv: string[], name: string): string {
    const index = argv.indexOf(name);
    return index >= 0 ? String(argv[index + 1] ?? '') : '';
  }
}
