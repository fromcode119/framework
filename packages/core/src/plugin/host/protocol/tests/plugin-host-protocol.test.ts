import { describe, expect, it } from 'vitest';
import { PluginHostProtocol } from '@core/plugin/host/protocol/plugin-host-protocol';

describe('PluginHostProtocol', () => {
  it('accepts a process that speaks this protocol, whatever Node it runs on', () => {
    expect(PluginHostProtocol.refusal(PluginHostProtocol.identity())).toBeNull();
    expect(PluginHostProtocol.refusal({ version: PluginHostProtocol.VERSION, node: 'v20.0.0' })).toBeNull();
  });

  it('refuses a different protocol, and a runtime that never said, with the reason', () => {
    expect(PluginHostProtocol.refusal({ version: PluginHostProtocol.VERSION + 1, node: process.version })).toContain(`speaks protocol ${PluginHostProtocol.VERSION + 1}`);
    expect(PluginHostProtocol.refusal(undefined)).toContain('predates the protocol handshake');
  });
});
