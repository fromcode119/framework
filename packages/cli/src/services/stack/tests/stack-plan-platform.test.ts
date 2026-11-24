import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { StackPlan } from '@cli/services/stack/stack-plan';

/** The gateway, the edge and the updater run the worktree's built code too, not the image's. */
describe('StackPlan platform services', () => {
  it('mounts the built packages and the version into the gateway, the edge and the updater, and no extension', () => {
    const framework = fs.mkdtempSync(path.join(os.tmpdir(), 'stack-platform-'));
    fs.mkdirSync(path.join(framework, 'deploy'), { recursive: true });
    fs.mkdirSync(path.join(framework, 'modules', 'cli', 'dist'), { recursive: true });
    fs.writeFileSync(path.join(framework, 'package.json'), JSON.stringify({ workspaces: ['modules/*'] }));
    fs.writeFileSync(path.join(framework, 'deploy', 'docker-compose.full-stack.yml'), 'services:\n  api:\n    volumes:\n      - ../plugins:/srv/plugins\n');

    const overlay = new StackPlan({ name: 'demo', framework, plugins: [], version: 'v1.0.0', port: 8200 }).overlay();
    const cli = `${path.join(framework, 'modules', 'cli', 'dist')}:`;
    for (const service of ['gateway', 'edge', 'updater']) {
      const section = overlay.split(`\n  ${service}:\n`)[1]?.split(/\n  \S/)[0] ?? '';
      expect(section).toContain(cli);
      expect(section).toContain(`${path.join(framework, 'package.json')}:`);
      expect(section).not.toContain('environment');
    }
    fs.rmSync(framework, { recursive: true, force: true });
  });
});
