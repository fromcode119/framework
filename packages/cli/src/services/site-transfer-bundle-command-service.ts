import chalk from 'chalk';
import { SiteTransferBundleService } from '@fromcode119/core';
import type { SiteTransferBundleOptions } from '@fromcode119/core';
import { CliUtils } from '../utils';

export class SiteTransferBundleCommandService {
  async execute(options: SiteTransferBundleOptions): Promise<void> {
    const database = await CliUtils.getDatabase();
    const service = new SiteTransferBundleService(database);

    try {
      const result = await service.createBundle(options);
      console.log(chalk.green('✔ Site transfer bundle created successfully.'));
      console.log(`${chalk.bold('Bundle Directory:')} ${result.bundleDirectory}`);
      console.log(`${chalk.bold('Manifest:')} ${result.manifestPath}`);
      console.log(`${chalk.bold('Archive:')} ${result.archivePath}`);
      if (result.checksumPath) {
        console.log(`${chalk.bold('Checksums:')} ${result.checksumPath}`);
      }
    } catch (error: any) {
      console.error(chalk.red('Site transfer bundle creation failed:'), error?.message || error);
      process.exit(1);
    }
  }
}