import { describe, expect, it } from 'vitest';
import { RuntimeService } from '../../plugin/services/runtime-service';

describe('RuntimeService.generateBridgeSource', () => {
  it('parenthesizes complex SDK accessors before property export lookup', () => {
    const runtimeService = new RuntimeService(process.cwd());
    const encoded = runtimeService.generateBridgeSource('@fromcode119/sdk', {
      type: 'lib',
      keys: ['BrowserStateClient', 'RuntimeLocationUtils'],
    });

    expect(encoded).toBeTruthy();

    const decoded = Buffer.from(String(encoded), 'base64').toString('utf8');
    expect(decoded).toContain(
      "export const BrowserStateClient = ((window.__fromcodeRuntimeModules && window.__fromcodeRuntimeModules['@fromcode119/sdk']) || window.Fromcode) ? ((window.__fromcodeRuntimeModules && window.__fromcodeRuntimeModules['@fromcode119/sdk']) || window.Fromcode)['BrowserStateClient'] : undefined;",
    );
    expect(decoded).toContain(
      "export const RuntimeLocationUtils = ((window.__fromcodeRuntimeModules && window.__fromcodeRuntimeModules['@fromcode119/sdk']) || window.Fromcode) ? ((window.__fromcodeRuntimeModules && window.__fromcodeRuntimeModules['@fromcode119/sdk']) || window.Fromcode)['RuntimeLocationUtils'] : undefined;",
    );
  });

  it('includes required browser react exports in the generated react bridge', () => {
    const runtimeService = new RuntimeService(process.cwd());
    const modules = runtimeService.getModules([] as any);
    const encoded = modules.react?.source;

    expect(encoded).toBeTruthy();

    const decoded = Buffer.from(String(encoded), 'base64').toString('utf8');
    expect(decoded).toContain("export const useInsertionEffect = (window.React) ? (window.React)['useInsertionEffect'] : undefined;");
    expect(decoded).toContain("export const useSyncExternalStore = (window.React) ? (window.React)['useSyncExternalStore'] : undefined;");
  });
});