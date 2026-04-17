import { describe, expect, it } from 'vitest';
import { BridgeObjectBuilder } from '../../react/src/helpers/bridge-object-builder';

describe('BridgeObjectBuilder', () => {
  it('includes client-safe SDK exports that plugin UI bundles instantiate at runtime', () => {
    const bridge = BridgeObjectBuilder.build({} as never);

    expect(bridge.BrowserStateClient).toBeTypeOf('function');
    expect(bridge.BrowserStateRuntimeBuilder).toBeTypeOf('function');
    expect(bridge.SystemAuthClient).toBeTypeOf('function');
    expect(bridge.SystemAuthSession).toBeTypeOf('function');
    expect(bridge.ApplicationUrlUtils).toBeTypeOf('function');
    expect(bridge.RuntimeLocationUtils).toBeTypeOf('function');
    expect(bridge.MediaRelationService).toBeTypeOf('function');
    expect(bridge.ClientRuntimeConstants).toBeTypeOf('function');
    expect(bridge.CookieConstants).toBeTypeOf('function');
  });
});