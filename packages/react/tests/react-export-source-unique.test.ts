import { describe, expect, it } from 'vitest';
import { ReactExportSourceBuilder } from '@react/helpers/react-export-source-builder';

/**
 * The generated `@fromcode119/react` module must declare every export exactly once. A bridge that already
 * carries a required key (LazyComponentLoaderService) was exported by the bridge loop AND by the required
 * list, and the browser refused the whole module: "Identifier … has already been declared".
 */
describe('the @fromcode119/react runtime module', () => {
  it('declares each name once, even when the bridge carries a required key', () => {
    const bridge = { Slot: {}, LazyComponentLoaderService: {}, LazyLoadClass: {}, ContextBridge: {} };
    const source = ReactExportSourceBuilder.buildReactExportSource(bridge, 'window.__runtime');
    const names = [...source.matchAll(/export const (\w+)/g)].map((match) => match[1]);
    expect(names.length).toBe(new Set(names).size);
    expect(names).toEqual(expect.arrayContaining(['Slot', 'LazyComponentLoaderService', 'LazyLoadClass', 'ContextBridge']));
  });

  it('still exports the required keys when the bridge lacks them', () => {
    const names = [...ReactExportSourceBuilder.buildReactExportSource({ Slot: {} }, 'window.__runtime').matchAll(/export const (\w+)/g)].map((match) => match[1]);
    expect(names).toEqual(expect.arrayContaining(['LazyComponentLoaderService', 'LazyLoadClass']));
  });
});
