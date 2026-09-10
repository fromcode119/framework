import { describe, expect, it } from 'vitest';
import { PluginStyleMarker } from '@extension-builder/assets/plugin-style-marker';

describe('PluginStyleMarker', () => {
  it('recognises its own output', () => {
    expect(PluginStyleMarker.isGenerated(`${PluginStyleMarker.CURRENT}\n.a{}`)).toBe(true);
  });

  it("still recognises build-plugins.sh's marker — every style.css on disk carries it", () => {
    expect(PluginStyleMarker.isGenerated(`${PluginStyleMarker.LEGACY}\n.a{}`)).toBe(true);
  });

  it('treats an unmarked sheet as hand-written', () => {
    expect(PluginStyleMarker.isGenerated('.mine{color:red}')).toBe(false);
  });
});
