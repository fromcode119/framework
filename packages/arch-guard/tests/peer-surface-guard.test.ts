import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { PeerSurfaceGuard } from '../src/peer-surface-guard';
import { FrameworkRoot } from '../src/cli/framework-root';

/**
 * The failure this exists for compiles, packs and boots, then dies at the call site with
 * "is not callable". Both directions are asserted, and so is every shape that must NOT fire — a guard
 * that cries wolf on the class shape would push people back towards hand-listing.
 */
describe('PeerSurfaceGuard', () => {
  const made: string[] = [];
  const plugin = (root: string, name: string, index: string, api: string) => {
    fs.mkdirSync(path.join(root, 'plugins', name, 'src'), { recursive: true });
    fs.writeFileSync(path.join(root, 'plugins', name, 'index.ts'), index);
    fs.writeFileSync(path.join(root, 'plugins', name, 'src', 'public-api.ts'), api);
  };
  const tree = () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'peer-surface-'));
    made.push(root);
    fs.mkdirSync(path.join(root, 'plugins'), { recursive: true });
    const original = FrameworkRoot.repo;
    (FrameworkRoot as any).repo = () => root;
    return { root, restore: () => { (FrameworkRoot as any).repo = original; } };
  };

  afterEach(() => { for (const dir of made.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });

  const API = (extra = '') => `export class ThingPublicApi {
  static async listThings(): Promise<void> {}
  static async getThing(): Promise<void> {}
${extra}}
`;
  const MAP = (keys: string[]) =>
    `export class Thing {\n  static readonly publicAPI = {\n${keys.map((k) => `    ${k}: ThingPublicApi.${k},`).join('\n')}\n  };\n}\n`;

  it('passes when the map lists every public static', () => {
    const { root, restore } = tree();
    plugin(root, 'thing', MAP(['listThings', 'getThing']), API());
    try { expect(PeerSurfaceGuard.run()).toBe(0); } finally { restore(); }
  });

  it('fails when a public static is missing from the map', () => {
    const { root, restore } = tree();
    plugin(root, 'thing', MAP(['listThings']), API());
    try { expect(PeerSurfaceGuard.run()).toBe(1); } finally { restore(); }
  });

  /** Assigning the CLASS exposes everything; there is no second list to drift from. */
  it('ignores the class shape entirely', () => {
    const { root, restore } = tree();
    plugin(root, 'thing', 'export class Thing {\n  static readonly publicAPI = ThingPublicApi;\n}\n', API());
    try { expect(PeerSurfaceGuard.run()).toBe(0); } finally { restore(); }
  });

  /** `private static` is already unreachable from a peer, so listing it would be the error. */
  it('does not ask for a private static to be exposed', () => {
    const { root, restore } = tree();
    plugin(root, 'thing', MAP(['listThings', 'getThing']), API('  private static helper(): void {}\n'));
    try { expect(PeerSurfaceGuard.run()).toBe(0); } finally { restore(); }
  });

  /**
   * Plumbing a plugin hands its OWN context to. Exposing it would let any plugin swap another's
   * runtime context, so its absence is correct rather than an oversight.
   */
  it('does not ask for setRuntimeContext to be exposed', () => {
    const { root, restore } = tree();
    plugin(root, 'thing', MAP(['listThings', 'getThing']), API('  static setRuntimeContext(): void {}\n'));
    try { expect(PeerSurfaceGuard.run()).toBe(0); } finally { restore(); }
  });

  it('ignores a plugin with no publicAPI at all', () => {
    const { root, restore } = tree();
    plugin(root, 'thing', 'export class Thing {}\n', API());
    try { expect(PeerSurfaceGuard.run()).toBe(0); } finally { restore(); }
  });
});
