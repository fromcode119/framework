import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

/**
 * Whether a source file belongs to a React Native package that an extension carries and publishes on its own
 * (an app runtime the extension's apps install from a registry).
 *
 * Such a package is compiled into a phone app with its own React, so hooks are its normal working tools; the
 * hook-free rule exists for extension UI that renders inside the admin's React. Only that rule is lifted:
 * every other shape rule still applies to these files.
 *
 * Recognised structurally, never by path: the nearest `package.json` between the file and its extension's
 * root (`manifest.json` / `theme.json`) must declare `react-native` as a dependency or peer dependency.
 * Extension UI has no such `package.json`, so it can never opt out this way.
 */
export class ReactNativePackage {
  private static readonly CACHE = new Map<string, boolean>();
  private static readonly ROOT_MARKERS = ['manifest.json', 'theme.json'];

  static owns(file: string): boolean {
    return ReactNativePackage.declares(path.dirname(file));
  }

  private static declares(dir: string): boolean {
    const known = ReactNativePackage.CACHE.get(dir);
    if (known !== undefined) return known;
    let answer = false;
    const manifest = path.join(dir, 'package.json');
    const atRoot = ReactNativePackage.ROOT_MARKERS.some((marker) => existsSync(path.join(dir, marker)));
    if (!atRoot && existsSync(manifest)) answer = ReactNativePackage.namesReactNative(manifest);
    else if (!atRoot && path.dirname(dir) !== dir) answer = ReactNativePackage.declares(path.dirname(dir));
    ReactNativePackage.CACHE.set(dir, answer);
    return answer;
  }

  private static namesReactNative(manifest: string): boolean {
    try {
      const pkg = JSON.parse(readFileSync(manifest, 'utf8'));
      return Boolean(pkg?.dependencies?.['react-native'] || pkg?.peerDependencies?.['react-native']);
    } catch {
      return false;
    }
  }
}
