import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import express from 'express';
import request from 'supertest';

/**
 * Serving `/uploads` for the site the request is for, WITHOUT 404ing what came before.
 *
 * The isolation half is easy and the compatibility half is the one that matters. Files written before
 * sites had their own directory sit flat in the shared parent, and there is no record of who uploaded
 * them — most have no media row at all. Resolving reads to the per-site directory alone would 404 the
 * overwhelming majority of existing images, which is a failure this platform has already had once.
 *
 * So: the site's own directory first, the shared parent behind it. New files are isolated by where
 * they are written; old ones keep resolving. The fallback cannot become a hole for new uploads,
 * because new uploads are not in the shared parent to be found.
 */

const HOSTS: Record<string, string> = { 'a.test': 'site-a', 'b.test': 'site-b' };

vi.mock('@fromcode119/core', async () => {
  const actual = await vi.importActual<any>('@fromcode119/core');
  return {
    ...actual,
    TenantMode: { isEnabled: () => true },
    TenantResolverService: {
      shared: () => ({ resolveByHost: async (host: string) => (HOSTS[host] ? { id: HOSTS[host] } : null) }),
    },
    ProjectPaths: { getUploadsRoot: () => (globalThis as any).__uploadsRoot },
    SystemConstants: { STORAGE: { TENANTS_SUBDIR: 'tenants' } },
    Logger: class { info() {} warn() {} error() {} },
  };
});

describe('tenant-scoped uploads static', () => {
  let root: string;
  let app: express.Express;

  const write = (dir: string, name: string, body: string) => {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, name), body);
  };

  beforeEach(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'uploads-static-'));
    (globalThis as any).__uploadsRoot = root;

    write(path.join(root, 'tenants', 'site-a'), 'own.txt', 'A');
    write(path.join(root, 'tenants', 'site-b'), 'own.txt', 'B');
    write(root, 'legacy.txt', 'OLD');

    const { TenantUploadsStatic } = await import('@api/server/tenant-uploads-static');
    app = express();
    app.use('/uploads', new TenantUploadsStatic({}, {}).middleware());
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
    vi.resetModules();
  });

  it('serves a site its OWN file', async () => {
    const res = await request(app).get('/uploads/own.txt').set('Host', 'a.test');
    expect(res.status).toBe(200);
    expect(res.text).toBe('A');
  });

  it('serves each site a DIFFERENT file under the same name', async () => {
    // The same URL, two answers. Before this, one flat directory meant one answer for everyone.
    const a = await request(app).get('/uploads/own.txt').set('Host', 'a.test');
    const b = await request(app).get('/uploads/own.txt').set('Host', 'b.test');

    expect(a.text).toBe('A');
    expect(b.text).toBe('B');
  });

  it('does NOT serve one site a file that exists only in another’s directory', async () => {
    write(path.join(root, 'tenants', 'site-a'), 'secret.txt', 'A-ONLY');

    const res = await request(app).get('/uploads/secret.txt').set('Host', 'b.test');

    expect(res.status).toBe(404);
  });

  it('STILL serves a legacy file from the shared parent — the thing that must not break', async () => {
    const res = await request(app).get('/uploads/legacy.txt').set('Host', 'a.test');

    expect(res.status).toBe(200);
    expect(res.text).toBe('OLD');
  });

  it('serves legacy files to a host that names no site, as it always did', async () => {
    const res = await request(app).get('/uploads/legacy.txt').set('Host', 'unknown.test');

    expect(res.status).toBe(200);
    expect(res.text).toBe('OLD');
  });

  it('prefers the site’s own file over a legacy one of the same name', async () => {
    write(root, 'own.txt', 'SHARED');

    const res = await request(app).get('/uploads/own.txt').set('Host', 'a.test');

    expect(res.text).toBe('A');
  });

  it('404s a file that exists nowhere', async () => {
    const res = await request(app).get('/uploads/nothing.txt').set('Host', 'a.test');
    expect(res.status).toBe(404);
  });
});
