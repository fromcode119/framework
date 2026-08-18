import { describe, expect, it } from 'vitest';
import { McpBridgeFactory } from '@mcp/mcp-bridge-factory';

describe('mcp test project', () => {
  it('collects tests from packages/mcp/tests', () => {
    expect(typeof McpBridgeFactory.create).toBe('function');
  });
});
