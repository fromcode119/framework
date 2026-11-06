import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

/**
 * Whether a source file is an Expo Router route: a screen or layout file under the `app/` (or `src/app/`)
 * folder of a package that runs on Expo Router.
 *
 * Expo Router finds each screen by its file and takes that file's DEFAULT export as the screen, so a route file
 * must default-export a function component — exactly as a Next route file must, which the guard already lets be.
 * Next's route files come from next-build-codegen; Expo Router has no such generator, so the function is
 * authored and only these files may hold one.
 *
 * Recognised structurally, never by path: the nearest `package.json` between the file and its extension's root
 * (`manifest.json` / `theme.json`) must declare `expo-router` as a dependency or peer dependency, and the file
 * must sit under that package's `app/` or `src/app/` folder.
 */
export class ExpoRouterRoute {
  private static readonly ROOT_MARKERS = ['manifest.json', 'theme.json'];

  static is(file: string): boolean {
    const root = ExpoRouterRoute.packageRoot(path.dirname(file));
    if (!root || !ExpoRouterRoute.namesExpoRouter(path.join(root, 'package.json'))) return false;
    const parts = path.relative(root, path.dirname(file)).split(path.sep);
    return parts[0] === 'app' || (parts[0] === 'src' && parts[1] === 'app');
  }

  /** The folder of the nearest `package.json`, or null at an extension's root or the file system's. */
  private static packageRoot(dir: string): string | null {
    if (ExpoRouterRoute.ROOT_MARKERS.some((marker) => existsSync(path.join(dir, marker)))) return null;
    if (existsSync(path.join(dir, 'package.json'))) return dir;
    return path.dirname(dir) === dir ? null : ExpoRouterRoute.packageRoot(path.dirname(dir));
  }

  private static namesExpoRouter(manifest: string): boolean {
    try {
      const pkg = JSON.parse(readFileSync(manifest, 'utf8'));
      return Boolean(pkg?.dependencies?.['expo-router'] || pkg?.peerDependencies?.['expo-router']);
    } catch {
      return false;
    }
  }
}
