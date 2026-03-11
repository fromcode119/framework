import { BackupService, ProjectPaths } from '@fromcode119/core';
import type { McpToolDefinition } from '@fromcode119/mcp';
import * as fs from 'fs';
import * as path from 'path';


export class BackupTools {
  static buildBackupManagementTools(): McpToolDefinition[] {
      return [
        {
          tool: 'backups.list',
          readOnly: true,
          description: 'List available backup files.',
          handler: async () => {
            const backupsRoot = path.resolve(ProjectPaths.getProjectRoot(), 'backups');
            if (!fs.existsSync(backupsRoot)) {
              return { backups: [] };
            }
            const types = fs.readdirSync(backupsRoot).filter((entry) => {
              const full = path.join(backupsRoot, entry);
              return fs.statSync(full).isDirectory();
            });
            const backups: Array<{ type: string; file: string; path: string; updatedAt: number }> = [];
            for (const type of types) {
              const dir = path.join(backupsRoot, type);
              for (const file of fs.readdirSync(dir)) {
                const full = path.join(dir, file);
                if (!fs.statSync(full).isFile()) continue;
                backups.push({
                  type,
                  file,
                  path: full,
                  updatedAt: fs.statSync(full).mtimeMs,
                });
              }
            }
            backups.sort((a, b) => b.updatedAt - a.updatedAt);
            return { backups };
          },
        },
        {
          tool: 'backups.create.system',
          readOnly: false,
          description: 'Create a full system backup snapshot.',
          handler: async (_input, context) => {
            if (context?.dryRun === true) {
              return {
                dryRun: true,
                operation: 'backups.create.system',
                note: 'Would create a full filesystem+database backup snapshot.',
              };
            }
            const backupPath = await BackupService.createSystemBackup();
            return {
              dryRun: false,
              operation: 'backups.create.system',
              backupPath,
            };
          },
        },
        {
          tool: 'backups.restore.path',
          readOnly: false,
          description: 'Restore a backup archive to a target directory (requires explicit approval).',
          handler: async (input, context) => {
            const backupPathInput = String(input?.backupPath || '').trim();
            const targetDirInput = String(input?.targetDir || '').trim();
            if (!backupPathInput) throw new Error('Missing backupPath');
            if (!targetDirInput) throw new Error('Missing targetDir');

            const resolvedBackupPath = path.isAbsolute(backupPathInput)
              ? backupPathInput
              : path.resolve(ProjectPaths.getProjectRoot(), backupPathInput.replace(/^\/+/, ''));
            const resolvedTargetDir = path.isAbsolute(targetDirInput)
              ? targetDirInput
              : path.resolve(ProjectPaths.getProjectRoot(), targetDirInput.replace(/^\/+/, ''));

            if (context?.dryRun === true) {
              return {
                dryRun: true,
                operation: 'backups.restore.path',
                backupPath: resolvedBackupPath,
                targetDir: resolvedTargetDir,
              };
            }

            await BackupService.restore(resolvedBackupPath, resolvedTargetDir);
            return {
              dryRun: false,
              operation: 'backups.restore.path',
              backupPath: resolvedBackupPath,
              targetDir: resolvedTargetDir,
            };
          },
        },
      ];

  }
}