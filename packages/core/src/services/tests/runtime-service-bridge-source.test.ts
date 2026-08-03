import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { RuntimeService } from '@core/plugin/services/runtime-service';

// framework/Source root, derived from this file — stable regardless of the suite's cwd. RuntimeService
// uses it only to anchor `require.resolve` during key discovery; the bridge SOURCES are compiled
// constants (`LibBridgeTemplate` & co), so nothing is read off disk.
const FRAMEWORK_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');

describe('RuntimeService.generateBridgeSource', () => {
  it('parenthesizes complex SDK accessors before property export lookup', () => {
    const runtimeService = new RuntimeService(FRAMEWORK_ROOT);
    const encoded = runtimeService.generateBridgeSource('@fromcode119/sdk', {
      type: 'lib',
      keys: ['BrowserStateClient', 'RuntimeLocationUtils'],
    });

    expect(encoded).toBeTruthy();

    const decoded = Buffer.from(String(encoded), 'base64').toString('utf8');
    const scoped =
      '((window.__fromcodeRuntimeModules && window.__fromcodeRuntimeModules["@fromcode119/sdk"]) || (window.__fromcodeRuntimeModules && window.__fromcodeRuntimeModules["@fromcode119/react"]))';
    expect(decoded).toContain(
      `export const BrowserStateClient = ${scoped} ? ${scoped}['BrowserStateClient'] : undefined;`,
    );
    expect(decoded).toContain(
      `export const RuntimeLocationUtils = ${scoped} ? ${scoped}['RuntimeLocationUtils'] : undefined;`,
    );
  });

  it('resolves browser react exports from the single runtime registry (react key)', () => {
    const runtimeService = new RuntimeService(FRAMEWORK_ROOT);
    // `react` is a client-handled module (served via the static import map), so it is intentionally
    // absent from getModules(); the bridge source is still generated on demand for the `react` key.
    const encoded = runtimeService.generateBridgeSource('react', {
      type: 'lib',
      keys: ['useInsertionEffect', 'useSyncExternalStore'],
    });

    expect(encoded).toBeTruthy();

    const decoded = Buffer.from(String(encoded), 'base64').toString('utf8');
    const scoped = '((window.__fromcodeRuntimeModules && window.__fromcodeRuntimeModules["react"]))';
    expect(decoded).toContain(`export const useInsertionEffect = ${scoped} ? ${scoped}['useInsertionEffect'] : undefined;`);
    expect(decoded).toContain(`export const useSyncExternalStore = ${scoped} ? ${scoped}['useSyncExternalStore'] : undefined;`);
  });
});