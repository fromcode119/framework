import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { ExpoRouterRoute } from '../src/oop-guard-rules/expo-router-route';

// An Expo Router screen must default-export a function component; only such a file may, and it is told apart by
// its package's own declaration, never by a path list.
const root = mkdtempSync(join(tmpdir(), 'expo-router-route-'));
const file = (relative: string): string => {
  const at = join(root, relative);
  mkdirSync(join(at, '..'), { recursive: true });
  writeFileSync(at, 'export default function Screen() { return null; }\n');
  return at;
};
const pkg = (dir: string, body: Record<string, unknown>): void => {
  mkdirSync(join(root, dir), { recursive: true });
  writeFileSync(join(root, dir, 'package.json'), JSON.stringify(body));
};

pkg('router-app', { peerDependencies: { 'expo-router': '*', 'react-native': '*' } });
pkg('plain-app', { dependencies: { 'react-native': '*' } });
pkg('extension/app-package', { dependencies: { 'expo-router': '*' } });
writeFileSync(join(root, 'extension', 'manifest.json'), '{}');

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe('ExpoRouterRoute', () => {
  it('sees a screen or layout under src/app or app of a package that runs on Expo Router', () => {
    expect(ExpoRouterRoute.is(file('router-app/src/app/_layout.tsx'))).toBe(true);
    expect(ExpoRouterRoute.is(file('router-app/src/app/settings/[id].tsx'))).toBe(true);
    expect(ExpoRouterRoute.is(file('router-app/app/index.tsx'))).toBe(true);
  });

  it('leaves the rest of that package to every rule', () => {
    expect(ExpoRouterRoute.is(file('router-app/src/components/card.tsx'))).toBe(false);
    expect(ExpoRouterRoute.is(file('router-app/src/lib/app/helper.tsx'))).toBe(false);
  });

  it('needs the package itself to name Expo Router', () => {
    expect(ExpoRouterRoute.is(file('plain-app/src/app/index.tsx'))).toBe(false);
  });

  it('does not climb past an extension root to find a package', () => {
    expect(ExpoRouterRoute.is(file('extension/src/app/index.tsx'))).toBe(false);
  });
});
