import { describe, it, expect, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ApiVersionLiteralGuard } from '../src/api-version-literal-guard';

/** Both sides: the shapes a hand-written path takes, and the look-alikes that are someone else's api. */
describe('ApiVersionLiteralGuard', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'api-version-literal-'));
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));
  const scan = (source: string, ext = 'ts'): number[] => {
    const file = path.join(dir, `f${Math.random().toString(36).slice(2)}.${ext}`);
    fs.writeFileSync(file, source);
    return ApiVersionLiteralGuard.scan(file);
  };

  it.each([
    "fetch('/api/v1/system/frontend')",
    'get(`/api/v1/${slug}`)',
    "joinApiPath(base, 'api/v1/auth/host')",
    'const url = `${base}/api/v1/system/frontend`;',
    "fetch('http://localhost:3000/api/v1/health')",
    "new Client('http://api:3000/api/v1')",
    "source: '/((?!api/v1/themes/).*)'",
  ])('flags %s', (line) => {
    expect(scan(line)).toEqual([1]);
  });

  it('flags a stylesheet url() and a manifest template with the version written in', () => {
    expect(scan("  src: url('/api/v1/themes/x/ui/fonts/a.woff2') format('woff2');", 'css')).toEqual([1]);
    expect(scan('{ "urlTemplate": "/api/v1/plugins/cms/img?src={value}" }', 'json')).toEqual([1]);
    expect(scan('{ "urlTemplate": "{api}/plugins/cms/img?src={value}" }', 'json')).toEqual([]);
  });

  it.each([
    "const API = 'https://uptime.betterstack.com/api/v2/monitors';",
    "baseUrl: 'https://api.openai.com/v1'",
    'ApiPathUtils.versioned(RouteConstants.SEGMENTS.HEALTH)',
    '// the api mounts /api/v1 for now',
    ' * `/api/v1/plugins/<slug>` in a doc comment',
    "const apiv1 = 'apiv1';",
  ])('leaves %s alone', (line) => {
    expect(scan(line)).toEqual([]);
  });
});
