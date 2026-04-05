import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

class FrameworkThemeSeedRunner {
  static async run() {
    const frameworkRoot = FrameworkThemeSeedRunner.resolveFrameworkRoot();
    const options = FrameworkThemeSeedRunner.parseArgs(process.argv.slice(2));

    if (options.help) {
      FrameworkThemeSeedRunner.printHelp();
      process.exit(0);
    }

    const themeRoot = FrameworkThemeSeedRunner.resolveThemeRoot(frameworkRoot, options);
    const seedFile = path.join(themeRoot, 'seed.ts');

    if (!fs.existsSync(seedFile)) {
      throw new Error(`[framework] Missing seed file: ${seedFile}`);
    }

    FrameworkThemeSeedRunner.ensureFrameworkPackageLinks(themeRoot, frameworkRoot);

    const firstPass = FrameworkThemeSeedRunner.runSeedPass(frameworkRoot, seedFile, options.databaseUrl);
    if (firstPass !== 0) {
      process.exit(firstPass);
    }

    if (options.noRestart) {
      process.exit(0);
    }

    const restarted = FrameworkThemeSeedRunner.restartApiContainer(options.containerName);
    if (!restarted) {
      process.exit(0);
    }

    process.exit(FrameworkThemeSeedRunner.runSeedPass(frameworkRoot, seedFile, options.databaseUrl));
  }

  static resolveFrameworkRoot() {
    return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  }

  static parseArgs(args) {
    const options = {
      theme: '',
      noRestart: false,
      containerName: '',
      databaseUrl: '',
      help: false,
    };

    for (let i = 0; i < args.length; i += 1) {
      const arg = String(args[i] || '').trim();
      if (!arg) continue;

      if (arg === '--help' || arg === '-h') {
        options.help = true;
        continue;
      }

      if (arg === '--no-restart') {
        options.noRestart = true;
        continue;
      }

      if (arg === '--container' || arg === '-c') {
        options.containerName = String(args[i + 1] || '').trim();
        i += 1;
        continue;
      }

      if (arg === '--database-url' || arg === '-d') {
        options.databaseUrl = String(args[i + 1] || '').trim();
        i += 1;
        continue;
      }

      if (arg === '--theme' || arg === '-t') {
        options.theme = String(args[i + 1] || '').trim();
        i += 1;
        continue;
      }

      if (arg.startsWith('--theme=')) {
        options.theme = arg.slice('--theme='.length).trim();
        continue;
      }

      if (arg.startsWith('--container=')) {
        options.containerName = arg.slice('--container='.length).trim();
        continue;
      }

      if (arg.startsWith('--database-url=')) {
        options.databaseUrl = arg.slice('--database-url='.length).trim();
      }
    }

    if (!options.theme) {
      options.theme = String(process.env.FROMCODE_THEME || '').trim();
    }

    if (!options.containerName) {
      options.containerName = String(process.env.FROMCODE_API_CONTAINER || '').trim();
    }

    if (!options.databaseUrl) {
      options.databaseUrl = String(process.env.DATABASE_URL || '').trim();
    }

    return options;
  }

  static resolveThemeRoot(frameworkRoot, options) {
    const input = String(options.theme || '').trim();
    if (!input) {
      throw new Error('[framework] Missing theme argument. Use --theme <slug|path> or set FROMCODE_THEME.');
    }

    const directPath = path.resolve(input);
    if (fs.existsSync(path.join(directPath, 'seed.ts'))) {
      return directPath;
    }

    const repoRoot = path.resolve(frameworkRoot, '..', '..');
    const bySlug = path.join(repoRoot, 'themes', input);
    if (fs.existsSync(path.join(bySlug, 'seed.ts'))) {
      return bySlug;
    }

    throw new Error(`[framework] Could not resolve theme: ${input}`);
  }

  static runSeedPass(frameworkRoot, seedFile, databaseUrl) {
    const env = {
      ...process.env,
    };

    if (databaseUrl) {
      env.DATABASE_URL = databaseUrl;
    }

    const result = spawnSync('npm', ['run', 'fromcode', '--', 'db', 'seed', '--file', seedFile], {
      cwd: frameworkRoot,
      stdio: 'inherit',
      env,
    });

    return typeof result.status === 'number' ? result.status : 1;
  }

  static ensureFrameworkPackageLinks(themeRoot, frameworkRoot) {
    const themeNodeModulesDir = path.join(themeRoot, 'node_modules');
    const frameworkNodeModulesDir = path.join(frameworkRoot, 'node_modules');

    if (!fs.existsSync(frameworkNodeModulesDir)) {
      throw new Error(`[framework] Missing framework node_modules at ${frameworkNodeModulesDir}`);
    }

    fs.mkdirSync(themeNodeModulesDir, { recursive: true });

    const scopeDirs = fs
      .readdirSync(frameworkNodeModulesDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.startsWith('@'))
      .map((entry) => entry.name);

    for (const scopeName of scopeDirs) {
      const targetScopeDir = path.join(themeNodeModulesDir, scopeName);
      const frameworkScopeDir = path.join(frameworkNodeModulesDir, scopeName);

      if (fs.existsSync(targetScopeDir)) {
        continue;
      }

      fs.symlinkSync(frameworkScopeDir, targetScopeDir, 'junction');
    }
  }

  static restartApiContainer(containerName) {
    if (!containerName) {
      return false;
    }

    const dockerBinary = spawnSync('which', ['docker'], { encoding: 'utf8' });
    if (dockerBinary.status !== 0) {
      return false;
    }

    const list = spawnSync('docker', ['ps', '-a', '--format', '{{.Names}}'], {
      encoding: 'utf8',
    });
    const names = String(list.stdout || '')
      .split('\n')
      .map((entry) => entry.trim())
      .filter(Boolean);

    if (!names.includes(containerName)) {
      return false;
    }

    const restart = spawnSync('docker', ['restart', containerName], {
      stdio: 'inherit',
      env: process.env,
    });
    if (restart.status !== 0) {
      throw new Error(`[framework] Failed to restart ${containerName} during theme seed bootstrap.`);
    }

    return true;
  }

  static printHelp() {
    // Intentionally simple output for terminal usage.
    process.stdout.write(
      [
        'Usage: npm run seed:theme -- --theme <slug|path> [--no-restart] [--container <name>] [--database-url <url>]',
        '',
        'Examples:',
        '  npm run seed:theme -- --theme <theme-slug>',
        '  npm run seed:theme -- --theme <absolute-or-relative-theme-path>',
        '  npm run seed:theme -- --theme <theme-slug> --container <api-container-name>',
        '  npm run seed:theme -- --theme <theme-slug> --database-url <database-url>',
        '  FROMCODE_THEME=<theme-slug> npm run seed:theme',
        '  FROMCODE_THEME=<theme-slug> DATABASE_URL=<database-url> npm run seed:theme',
        '  FROMCODE_THEME=<theme-slug> FROMCODE_API_CONTAINER=<api-container-name> npm run seed:theme',
      ].join('\n'),
    );
    process.stdout.write('\n');
  }
}

FrameworkThemeSeedRunner.run().catch((error) => {
  console.error('[framework] Theme seed runner failed:', error);
  process.exit(1);
});
