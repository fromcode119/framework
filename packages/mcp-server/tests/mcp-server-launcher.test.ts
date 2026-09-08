import { describe, expect, it } from 'vitest';
import { McpServerLauncher } from '@mcp-server/mcp-server-launcher';
import { McpStdioServer } from '@mcp-server/mcp-stdio-server';

describe('McpServerLauncher.create', () => {
  it('throws the usage message when the URL is missing', () => {
    expect(() => McpServerLauncher.create({ FROMCODE_API_TOKEN: 'secret' })).toThrow(McpServerLauncher.USAGE);
  });

  it('throws the usage message when the token is missing', () => {
    expect(() => McpServerLauncher.create({ FROMCODE_API_URL: 'https://example.test' })).toThrow(McpServerLauncher.USAGE);
  });

  it('throws when values are present but blank', () => {
    expect(() => McpServerLauncher.create({ FROMCODE_API_URL: '  ', FROMCODE_API_TOKEN: '' })).toThrow(McpServerLauncher.USAGE);
  });

  it('accepts an optional preselected site', () => {
    expect(McpServerLauncher.create({ FROMCODE_API_URL: 'https://example.test', FROMCODE_API_TOKEN: 'secret', FROMCODE_SITE: 'acme' })).toBeInstanceOf(McpStdioServer);
  });

  it('wires a stdio server when both values are set', () => {
    const server = McpServerLauncher.create({ FROMCODE_API_URL: 'https://example.test', FROMCODE_API_TOKEN: 'secret' });
    expect(server).toBeInstanceOf(McpStdioServer);
  });
});
