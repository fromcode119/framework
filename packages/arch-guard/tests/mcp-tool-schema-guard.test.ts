import { describe, expect, it } from 'vitest';
import { McpToolSchemaGuard } from '../src/mcp-tool-schema-guard';

describe('McpToolSchemaGuard.findViolations', () => {
  it('accepts a tool literal carrying both a schema and a permission', () => {
    const source = `
      const t = {
        tool: 'content.list',
        permission: 'content:read',
        inputSchema: McpSchema.object({}),
        handler: () => ({}),
      };`;
    expect(McpToolSchemaGuard.findViolations('a.ts', source)).toEqual([]);
  });

  it('flags a tool literal with no inputSchema', () => {
    const source = `
      const t = {
        tool: 'content.list',
        permission: 'content:read',
        handler: () => ({}),
      };`;
    expect(McpToolSchemaGuard.findViolations('a.ts', source))
      .toEqual([{ file: 'a.ts', tool: 'content.list', missing: 'inputSchema' }]);
  });

  it('flags a tool literal with no permission', () => {
    const source = `
      const t = {
        tool: 'content.list',
        inputSchema: McpSchema.object({}),
        handler: () => ({}),
      };`;
    expect(McpToolSchemaGuard.findViolations('a.ts', source))
      .toEqual([{ file: 'a.ts', tool: 'content.list', missing: 'permission' }]);
  });

  it('reports each offending tool in a file that defines several', () => {
    const source = `
      const a = { tool: 'content.list', permission: 'content:read', inputSchema: {}, handler: () => ({}) };
      const b = { tool: 'content.create', permission: 'content:write', handler: () => ({}) };`;
    const violations = McpToolSchemaGuard.findViolations('a.ts', source);
    expect(violations).toEqual([{ file: 'a.ts', tool: 'content.create', missing: 'inputSchema' }]);
  });
});
