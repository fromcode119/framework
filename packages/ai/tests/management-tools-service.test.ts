import * as fs from 'fs';
import * as path from 'path';
import { CliUtils } from '@fromcode119/core';
import { AssistantManagementToolsService } from '../src/api/forge/management-tools-service';

describe('assistant management file tools', () => {
  it('creates a backup before writing plugin file replacements', async () => {
    const manager: any = {
      getPlugins: () => [],
      getSortedPlugins: () => [],
    };
    const themeManager: any = {
      getThemes: () => [],
    };
    const service = new AssistantManagementToolsService(manager, themeManager);
    const replaceTool: any = service.buildTools().find((tool) => tool.tool === 'plugins.files.replace_text');
    expect(replaceTool).toBeTruthy();

    const projectRoot = CliUtils();
    const slug = `zz-assistant-backup-test-${Date.now()}`;
    const pluginRoot = path.resolve(projectRoot, 'plugins', slug, 'src');
    const filePath = path.resolve(pluginRoot, 'contact.ts');
    const beforeValue = '07000 000000';
    const afterValue = '07000 000001';

    fs.mkdirSync(pluginRoot, { recursive: true });
    fs.writeFileSync(filePath, `export const PHONE = "${beforeValue}";\n`, 'utf8');

    let backupPath: string | undefined;
    try {
      const result = await replaceTool.handler(
        {
          slug,
          path: 'src/contact.ts',
          from: beforeValue,
          to: afterValue,
        },
        { dryRun: false },
      );

      backupPath = String(result?.backupPath || '').trim() || undefined;
      expect(result?.changed).toBe(true);
      expect(backupPath).toBeTruthy();
      expect(fs.existsSync(filePath)).toBe(true);
      expect(fs.readFileSync(filePath, 'utf8')).toContain(afterValue);
      expect(backupPath && fs.existsSync(backupPath)).toBe(true);
      if (backupPath) {
        expect(fs.readFileSync(backupPath, 'utf8')).toContain(beforeValue);
      }
    } finally {
      fs.rmSync(path.resolve(projectRoot, 'plugins', slug), { recursive: true, force: true });
      if (backupPath) {
        const backupsRoot = path.resolve(projectRoot, 'backups', 'assistant-files');
        const relative = path.relative(backupsRoot, backupPath);
        const stamp = String(relative || '').split(path.sep)[0];
        if (stamp && stamp !== '.' && stamp !== '..') {
          fs.rmSync(path.resolve(backupsRoot, stamp), { recursive: true, force: true });
        }
      }
    }
  });
});
