import { afterEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ProjectPaths } from './paths';

describe('ProjectPaths repository helpers', () => {
  const temporaryDirectories: string[] = [];

  afterEach(() => {
    delete process.env.FROMCODE_PROJECT_ROOT;
    (ProjectPaths as any).cachedRoot = null;

    for (const directoryPath of temporaryDirectories) {
      if (fs.existsSync(directoryPath)) {
        fs.rmSync(directoryPath, { recursive: true, force: true });
      }
    }
    temporaryDirectories.length = 0;
  });

  it('defaults repository root to the framework root instead of scanning parent folders', () => {
    const originalCwd = process.cwd();
    const parentRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-parent-'));
    const frameworkRoot = path.join(parentRoot, 'framework', 'Source');
    temporaryDirectories.push(parentRoot);
    fs.mkdirSync(frameworkRoot, { recursive: true });
    fs.writeFileSync(path.join(frameworkRoot, 'package.json'), JSON.stringify({ name: '@fromcode119/framework' }), 'utf8');
    fs.mkdirSync(path.join(parentRoot, 'artifacts'), { recursive: true });
    fs.mkdirSync(path.join(parentRoot, 'plugins'), { recursive: true });
    fs.mkdirSync(path.join(parentRoot, 'themes'), { recursive: true });
    fs.writeFileSync(path.join(parentRoot, 'AGENTS.md'), '# test\n', 'utf8');
    process.env.FROMCODE_PROJECT_ROOT = frameworkRoot;

    process.chdir(frameworkRoot);

    try {
      expect(ProjectPaths.getRepositoryRoot()).toBe(frameworkRoot);
      expect(ProjectPaths.getRepositoryArtifactsDir('site-transfer')).toBe(path.join(frameworkRoot, 'artifacts', 'site-transfer'));
    } finally {
      process.chdir(originalCwd);
    }
  });
});