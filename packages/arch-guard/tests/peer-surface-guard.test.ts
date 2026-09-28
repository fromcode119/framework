import { describe, it, expect, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { PeerSurfaceGuard } from '../src/peer-surface-guard';

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
    for (const [variable, area] of [['PLUGINS_DIR', 'plugins'], ['THEMES_DIR', 'themes'], ['APPEARANCE_DIR', 'appearance']]) {
      vi.stubEnv(variable, path.join(root, area));
    }
    return { root, restore: () => { vi.unstubAllEnvs(); } };
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

  /**
   * A map drawing on TWO classes. Only the last class was checked, so a method missing from the FIRST
   * shipped, and the peer that called it got "is not callable".
   */
  it('checks every class a map draws on, not only the last one', () => {
    const { root, restore } = tree();
    fs.mkdirSync(path.join(root, 'plugins', 'shop', 'src'), { recursive: true });
    fs.writeFileSync(path.join(root, 'plugins', 'shop', 'index.ts'), `export class Shop {
  static readonly publicAPI = {
    listOrders: ShopPublicApi.listOrders,
    registerProvider: ShopFulfillmentPublicApi.registerProvider,
  };
}
`);
    fs.writeFileSync(path.join(root, 'plugins', 'shop', 'src', 'public-api.ts'), `export class ShopPublicApi {
  static async listOrders(): Promise<void> {}
  static async listDeliveredSales(): Promise<void> {}
}
`);
    fs.writeFileSync(path.join(root, 'plugins', 'shop', 'src', 'fulfillment-public-api.ts'), `export class ShopFulfillmentPublicApi {
  static async registerProvider(): Promise<void> {}
}
`);
    const errors: string[] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((message: string) => { errors.push(String(message)); });
    try {
      expect(PeerSurfaceGuard.run()).toBe(1);
      expect(errors.join('\n')).toContain('ShopPublicApi.listDeliveredSales is not in the publicAPI map');
    } finally { spy.mockRestore(); restore(); }
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
