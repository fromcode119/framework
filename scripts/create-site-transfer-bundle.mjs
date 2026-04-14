import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

export class SiteTransferBundleScriptRunner {
  static async run() {
    const frameworkRoot = SiteTransferBundleScriptRunner.resolveFrameworkRoot();
    const args = SiteTransferBundleScriptRunner.parseArgs(process.argv.slice(2));

    if (args.help) {
      SiteTransferBundleScriptRunner.printHelp();
      process.exit(0);
    }

    const command = SiteTransferBundleScriptRunner.createCommand(args.forwardedArgs);
    const result = spawnSync('npm', command, {
      cwd: frameworkRoot,
      stdio: 'inherit',
      env: process.env,
    });

    process.exit(typeof result.status === 'number' ? result.status : 1);
  }

  static resolveFrameworkRoot() {
    return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  }

  static createCommand(forwardedArgs) {
    return ['run', 'fromcode', '--', 'system', 'site-transfer-bundle', ...forwardedArgs];
  }

  static parseArgs(args) {
    const forwardedArgs = [];
    let help = false;

    for (let index = 0; index < args.length; index += 1) {
      const value = String(args[index] || '').trim();
      if (!value) {
        continue;
      }

      if (value === '--help' || value === '-h') {
        help = true;
        continue;
      }

      if (!SiteTransferBundleScriptRunner.isAllowedArgument(value)) {
        throw new Error(`[framework] Unsupported argument: ${value}`);
      }

      forwardedArgs.push(value);
      if (SiteTransferBundleScriptRunner.requiresValue(value)) {
        const nextValue = String(args[index + 1] || '').trim();
        if (!nextValue) {
          throw new Error(`[framework] Missing value for ${value}`);
        }
        forwardedArgs.push(nextValue);
        index += 1;
      }
    }

    return { forwardedArgs, help };
  }

  static isAllowedArgument(value) {
    const allowedFlags = new Set([
      '--output',
      '--label',
      '--include-uploads',
      '--include-public',
      '--include-secrets',
      '--skip-checksum',
    ]);

    if (allowedFlags.has(value)) {
      return true;
    }

    return [
      '--output=',
      '--label=',
    ].some((prefix) => value.startsWith(prefix));
  }

  static requiresValue(value) {
    return value === '--output' || value === '--label';
  }

  static printHelp() {
    process.stdout.write(
      [
        'Usage: npm run bundle:site-transfer -- [--output <dir>] [--label <label>] [--include-uploads] [--include-public] [--include-secrets] [--skip-checksum]',
        '',
        'This wrapper delegates to: npm run fromcode -- system site-transfer-bundle',
        'Use --include-secrets only when an operator explicitly accepts the risk of bundling secret material.',
      ].join('\n') + '\n',
    );
  }

  static isDirectExecution(metaUrl) {
    return Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(metaUrl);
  }
}

if (SiteTransferBundleScriptRunner.isDirectExecution(import.meta.url)) {
  SiteTransferBundleScriptRunner.run().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  });
}