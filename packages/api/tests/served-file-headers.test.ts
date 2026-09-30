import express from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { PluginArchiveSupport } from '@api/controllers/plugins/plugin-archive-support';
import { ThemeArchiveSupport } from '@api/controllers/themes/theme-archive-support';
import { ThemeAssetScope } from '@api/controllers/themes/enums/theme-asset-scope.enum';
import { ServedFileHeaderService } from '@api/services/served-file-header-service';
import { PluginState } from '@fromcode119/core';

/**
 * A theme's or plugin's files are served on every host the api answers, the shared admin included. A
 * site put an `.html` in its theme's `public/`, sent a platform administrator the admin-host URL, and
 * the page ran in the admin's origin with that administrator's session. A document is now served in
 * an opaque origin, and nothing is served as a type other than the one its name says.
 */
describe('a file the platform serves but did not write', () => {
  const dirs: string[] = [];
  afterEach(() => { while (dirs.length) fs.rmSync(dirs.pop() as string, { recursive: true, force: true }); });

  function packageWith(files: Record<string, string>): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-served-'));
    dirs.push(dir);
    for (const [name, content] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
      fs.writeFileSync(path.join(dir, name), content);
    }
    return dir;
  }

  it('a plugin\'s HTML is served sandboxed; its script and stylesheet load as before', async () => {
    const dir = packageWith({ 'ui/x.html': '<script>steal()</script>', 'ui/frontend.js': 'export {}', 'ui/style.css': 'a{}' });
    const support = new PluginArchiveSupport({ getPlugins: () => [{ manifest: { slug: 'site-thing' }, path: dir, state: PluginState.ACTIVE }] } as any);
    const app = express();
    app.get('/plugins/:slug/ui/*assetPath', (req, res) => support.serveAssets(req, res));

    const page = await request(app).get('/plugins/site-thing/ui/x.html');
    expect(page.status).toBe(200);
    expect(page.headers['content-security-policy']).toBe(ServedFileHeaderService.DOCUMENT_POLICY);
    expect(page.headers['x-content-type-options']).toBe('nosniff');

    const script = await request(app).get('/plugins/site-thing/ui/frontend.js');
    expect(script.status).toBe(200);
    expect(script.headers['content-security-policy']).toBeUndefined();
    expect(script.headers['x-content-type-options']).toBe('nosniff');
  });

  it('a theme\'s HTML and SVG in public/ are served sandboxed', async () => {
    const dir = packageWith({ 'public/x.html': '<script>steal()</script>', 'public/logo.svg': '<svg onload="steal()"/>', 'public/font.woff2': 'x' });
    const support = new ThemeArchiveSupport({ getThemes: () => [{ slug: 'site-theme' }], getThemeDirectory: () => dir } as any);
    const app = express();
    app.get('/themes/:slug/public/*assetPath', (req, res) => support.serveAssetDirectory(req, res, ThemeAssetScope.PUBLIC));

    for (const file of ['x.html', 'logo.svg']) {
      const reply = await request(app).get(`/themes/site-theme/public/${file}`);
      expect(reply.status).toBe(200);
      expect(reply.headers['content-security-policy']).toBe(ServedFileHeaderService.DOCUMENT_POLICY);
    }
    const font = await request(app).get('/themes/site-theme/public/font.woff2');
    expect(font.headers['content-security-policy']).toBeUndefined();
    expect(font.headers['x-content-type-options']).toBe('nosniff');
  });

  it('judges a compressed copy by the file it compresses', () => {
    expect(ServedFileHeaderService.for('/x/page.html.gz')['Content-Security-Policy']).toBe(ServedFileHeaderService.DOCUMENT_POLICY);
    expect(ServedFileHeaderService.for('/x/app.js.gz')['Content-Security-Policy']).toBeUndefined();
  });
});
