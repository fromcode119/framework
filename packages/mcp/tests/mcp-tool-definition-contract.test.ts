import { describe, expect, it } from 'vitest';
import type { IMcpToolDefinition } from '@mcp/interfaces/mcp-tool-definition.interface';
import type { IMcpToolSummary } from '@mcp/interfaces/mcp-tool-summary.interface';

describe('IMcpToolDefinition', () => {
  it('carries an input schema, a permission and a title', () => {
    const tool: IMcpToolDefinition = {
      tool: 'content.list',
      title: 'List content',
      description: 'List records in a collection.',
      readOnly: true,
      permission: 'content:read',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      handler: () => ({ items: [] }),
    };
    expect(tool.permission).toBe('content:read');
    expect(tool.inputSchema).toEqual({ type: 'object', properties: {}, additionalProperties: false });
  });
});

describe('IMcpToolSummary', () => {
  it('requires permission and inputSchema', () => {
    const summary: IMcpToolSummary = {
      tool: 'content.list',
      readOnly: true,
      permission: 'content:read',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    };
    expect(summary.tool).toBe('content.list');
  });
});
