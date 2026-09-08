import { describe, expect, it } from 'vitest';
import { McpWirePaths } from '@mcp/mcp-wire-paths';
import { McpRouteUtils } from '@api/utils/mcp-route-utils';

/** The api mount and the client composition read the same constants — pinned here. */
describe('MCP wire path parity', () => {
  it('the api mount derives from the contract BASE', () => {
    expect(McpRouteUtils.BASE_PATH).toBe(McpWirePaths.BASE);
  });

  it('the client paths extend the same BASE', () => {
    expect(McpWirePaths.TOOLS).toBe(`${McpWirePaths.BASE}/tools`);
    expect(McpWirePaths.TOOLS_CALL).toBe(`${McpWirePaths.BASE}/tools/call`);
  });
});
