import { describe, expect, it } from 'vitest';
import { McpMediaTools } from '@api/controllers/mcp/tools/mcp-media-tools';

describe('McpMediaTools remote input security', () => {
  const deps = { settingsCache: new Map([['mcp_remote_media_max_mb', '25']]) } as any;

  it.each([
    'http://127.0.0.1/private',
    'http://169.254.169.254/latest/meta-data',
    'http://[::1]/private',
  ])('refuses non-public source URL %s', async (sourceUrl) => {
    await expect((McpMediaTools as any).fetchRemoteBytes(deps, sourceUrl)).rejects.toThrow(/non-public/i);
  });

  it('refuses URL credentials before fetching', async () => {
    await expect((McpMediaTools as any).fetchRemoteBytes(deps, 'https://user:pass@example.com/file'))
      .rejects.toThrow(/credentials/i);
  });

  it('caps base64 input at the same 25 MB boundary as remote downloads', async () => {
    const oversized = Buffer.alloc((25 * 1024 * 1024) + 1).toString('base64');
    await expect((McpMediaTools as any).readBytes(deps, { base64: oversized })).rejects.toThrow(/25 MB/i);
  });

  it('uses the operator-configured media limit', async () => {
    const limited = { settingsCache: new Map([['mcp_remote_media_max_mb', '1']]) } as any;
    const oversized = Buffer.alloc((1024 * 1024) + 1).toString('base64');
    await expect((McpMediaTools as any).readBytes(limited, { base64: oversized })).rejects.toThrow(/1 MB/i);
  });
});
