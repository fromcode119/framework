import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { PluginContextFileReader } from '../plugin-context-file-reader';

export class PluginContextFileReaderTestHelpers {
  private static readonly tempDirectories = new Set<string>();

  static createTempDirectory(): string {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-context-file-reader-'));
    this.tempDirectories.add(directory);
    return directory;
  }

  static cleanup(): void {
    for (const directory of this.tempDirectories) {
      fs.rmSync(directory, { recursive: true, force: true });
    }
    this.tempDirectories.clear();
  }
}

describe('PluginContextFileReader', () => {
  afterEach(() => {
    PluginContextFileReaderTestHelpers.cleanup();
  });

  it('prefers the active theme file before the plugin file', async () => {
    const pluginRoot = PluginContextFileReaderTestHelpers.createTempDirectory();
    const themeRoot = PluginContextFileReaderTestHelpers.createTempDirectory();
    const pluginTemplatePath = path.join(pluginRoot, 'templates', 'emails', 'message.txt');
    const themeTemplatePath = path.join(themeRoot, 'templates', 'plugins', 'forms', 'emails', 'message.txt');

    fs.mkdirSync(path.dirname(pluginTemplatePath), { recursive: true });
    fs.mkdirSync(path.dirname(themeTemplatePath), { recursive: true });
    fs.writeFileSync(pluginTemplatePath, 'plugin message');
    fs.writeFileSync(themeTemplatePath, 'theme message');

    const reader = new PluginContextFileReader(
      () => pluginRoot,
      async () => themeRoot,
    );

    await expect(reader.readText('emails/message.txt', {
      pluginDirectory: 'templates',
      themeDirectory: 'templates/plugins/forms',
    })).resolves.toBe('theme message');
  });

  it('reads plugin json files from the requested directory', async () => {
    const pluginRoot = PluginContextFileReaderTestHelpers.createTempDirectory();
    const configPath = path.join(pluginRoot, 'defaults', 'contact-form.json');

    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify({ slug: 'contact', autoResponderEnabled: true }));

    const reader = new PluginContextFileReader(
      () => pluginRoot,
      async () => null,
    );

    await expect(reader.readJson('contact-form.json', {
      pluginDirectory: 'defaults',
    })).resolves.toEqual({ slug: 'contact', autoResponderEnabled: true });
  });

  it('rejects parent-directory traversal in relative paths', async () => {
    const pluginRoot = PluginContextFileReaderTestHelpers.createTempDirectory();
    const reader = new PluginContextFileReader(
      () => pluginRoot,
      async () => null,
    );

    await expect(reader.readText('../secret.txt', {
      pluginDirectory: 'templates',
    })).resolves.toBe('');
    await expect(reader.readJson('../secret.json', {
      pluginDirectory: 'defaults',
    })).resolves.toEqual({});
  });
});
