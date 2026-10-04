import fs from 'fs';
import os from 'os';
import path from 'path';
import AdmZip from 'adm-zip';
import { afterEach, describe, expect, it } from 'vitest';
import { PluginArchiveSupport } from '@api/controllers/plugins/plugin-archive-support';
import { ThemeArchiveSupport } from '@api/controllers/themes/theme-archive-support';

/**
 * The upload dialogs' "Install Impact" section reads `existing.installed / version / state`. The
 * inspect answers used to send `existingVersion` and `action` instead, so every upload said "not
 * currently installed" — including one about to replace a running plugin or theme.
 */

const TEMP: string[] = [];

function zipOf(files: Record<string, string>): string {
  const zip = new AdmZip();
  for (const [name, content] of Object.entries(files)) zip.addFile(name, Buffer.from(content));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-inspect-'));
  TEMP.push(dir);
  const file = path.join(dir, 'package.zip');
  zip.writeZip(file);
  return file;
}

afterEach(() => {
  while (TEMP.length) fs.rmSync(TEMP.pop() as string, { recursive: true, force: true });
});

describe('inspecting an uploaded plugin', () => {
  const archive = () => zipOf({ 'manifest.json': JSON.stringify({ slug: 'acme', namespace: 'com.acme', name: 'Acme', version: '2.0.0' }), 'index.js': '' });

  it('names the installed copy an upload would replace', async () => {
    const manager = { getPlugins: () => [{ manifest: { slug: 'acme', version: '1.4.0', namespace: 'org.fromcode' }, state: 'active' }] } as any;

    const info = await new PluginArchiveSupport(manager).inspectPluginArchive(archive(), 'package.zip');

    // Both vendors, so the dialog can say the install would be refused before anyone presses Install.
    expect(info.namespace).toBe('com.acme');
    expect(info.existing).toEqual({ installed: true, version: '1.4.0', state: 'active', namespace: 'org.fromcode' });
  });

  it('says nothing is replaced when the slug is new', async () => {
    const info = await new PluginArchiveSupport({ getPlugins: () => [] } as any).inspectPluginArchive(archive(), 'package.zip');

    expect(info.existing).toEqual({ installed: false });
  });
});

describe('inspecting an uploaded theme', () => {
  const archive = () => zipOf({
    'theme.json': JSON.stringify({ slug: 'acme-theme', namespace: 'com.acme', name: 'Acme', version: '3.0.0' }),
    'ui/index.js': '',
    'plugins/acme-blog.zip': 'x',
  });

  it('names the installed copy, counts files and lists bundled archives the way the dialog reads them', async () => {
    const manager = { getThemes: () => [{ slug: 'acme-theme', version: '2.1.0', state: 'active' }] } as any;

    const info = await new ThemeArchiveSupport(manager).inspectThemeArchive(archive(), 'package.zip');

    expect(info.namespace).toBe('com.acme');
    // The installed theme declares no vendor, so nothing would be refused and the field says so.
    expect(info.existing).toEqual({ installed: true, version: '2.1.0', state: 'active', namespace: '' });
    expect(info.files).toBe(3);
    expect(info.bundledPlugins.map((entry: any) => entry.archive)).toEqual(['plugins/acme-blog.zip']);
  });
});
