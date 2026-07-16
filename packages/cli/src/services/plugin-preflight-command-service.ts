import path from 'path';
import fs from 'fs-extra';
import { Command } from 'commander';
import chalk from 'chalk';
import { SystemConstants, PluginHealthReportService } from '@fromcode119/core';
import type { PluginHealthEntry, PluginHealthEntryInput, PluginHealthReport } from '@fromcode119/core';
import { CliUtils } from '../utils';

/**
 * Deploy gate. Reads plugin state DIRECTLY from the `_system_plugins` registry (never through the
 * running API, so it works mid-deploy) and each plugin's on-disk `manifest.json` capabilities, then
 * builds the shared `PluginHealthReportService` report. Prints a summary and exits NON-ZERO when any
 * plugin is held (capability drift) or errored — wire it into CI/deploy pipelines to block a bad ship.
 */
export class PluginPreflightCommandService {
  private static readonly TABLE = SystemConstants.TABLE.PLUGINS;

  static exitCodeFor(report: { ok: boolean }): number {
    return report.ok ? 0 : 1;
  }

  static register(pluginCommand: Command): void {
    pluginCommand
      .command('preflight')
      .description('Check installed plugins for capability drift / held / errored state; non-zero exit if any need attention')
      .action(async () => {
        await PluginPreflightCommandService.run();
      });
  }

  private static async run(): Promise<void> {
    const db = await CliUtils.getDatabase();
    const pluginsDir = CliUtils.getPluginsDir();
    const inputs: PluginHealthEntryInput[] = [];
    const rows = await db.find(PluginPreflightCommandService.TABLE, { orderBy: { slug: 'asc' }, limit: 1000 });
    for (const row of rows) {
      const slug = String(row.slug || '').trim();
      if (!slug) continue;
      const approvedCapabilities = PluginPreflightCommandService.parseCaps(row.capabilities);
      const manifestCapabilities = PluginPreflightCommandService.readManifestCaps(pluginsDir, slug, approvedCapabilities);
      inputs.push({
        slug,
        state: String(row.state || 'unknown'),
        // CLI reads the RAW db manager (framework-side), which returns snake_case columns — the same
        // way plugin-state-service reads this table. Prefer snake_case; keep a camelCase fallback in
        // case a proxied manager is ever passed in.
        healthStatus: (row.health_status ?? row.healthStatus) ? String(row.health_status ?? row.healthStatus) : undefined,
        heldReason: (row.held_reason ?? row.heldReason) ? String(row.held_reason ?? row.heldReason) : undefined,
        error: row.error ? String(row.error) : undefined,
        manifestCapabilities,
        approvedCapabilities,
      });
    }

    const report = PluginHealthReportService.buildReport(inputs);
    PluginPreflightCommandService.print(report);
    process.exitCode = PluginPreflightCommandService.exitCodeFor(report);
  }

  private static parseCaps(value: unknown): string[] {
    if (Array.isArray(value)) return value.map((c) => String(c));
    if (typeof value === 'string' && value.trim()) {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed.map((c) => String(c));
      } catch {
        return [];
      }
    }
    return [];
  }

  /**
   * Reads `plugins/<slug>/manifest.json` capabilities. When there is no manifest.json (inline-manifest
   * plugins define it in index.ts), fall back to the approved set so drift isn't falsely reported.
   */
  private static readManifestCaps(pluginsDir: string, slug: string, approved: string[]): string[] {
    const manifestPath = path.join(pluginsDir, slug, 'manifest.json');
    if (!fs.existsSync(manifestPath)) return approved;
    try {
      const manifest = fs.readJsonSync(manifestPath);
      return PluginPreflightCommandService.parseCaps(manifest?.capabilities);
    } catch {
      return approved;
    }
  }

  private static print(report: PluginHealthReport): void {
    const { counts } = report;
    console.log(chalk.white(`\nPlugin preflight — ${counts.total} plugin(s):`));
    console.log(
      chalk.gray('  ') +
        `${chalk.green(counts.active + ' active')}  ` +
        `${chalk.yellow(counts.held + ' held')}  ` +
        `${chalk.red(counts.error + ' error')}  ` +
        `${chalk.gray(counts.inactive + ' inactive')}`,
    );
    console.log(chalk.gray('--------------------------------------------------'));

    for (const entry of report.held) {
      console.log(`${chalk.yellow('HELD')}    ${chalk.bold(entry.slug)}${PluginPreflightCommandService.driftSuffix(entry)}`);
      if (entry.heldReason) console.log(chalk.gray(`        reason: ${entry.heldReason}`));
    }
    for (const entry of report.error) {
      console.log(`${chalk.red('ERROR')}   ${chalk.bold(entry.slug)}`);
      if (entry.error) console.log(chalk.gray(`        ${entry.error}`));
    }

    if (report.ok) {
      console.log(chalk.green('\n✔ All plugins healthy.\n'));
    } else {
      console.log(chalk.red(`\n✖ ${counts.held + counts.error} plugin(s) need attention.\n`));
    }
  }

  private static driftSuffix(entry: PluginHealthEntry): string {
    const added = entry.addedCapabilities.map((c) => chalk.green(`+${c}`));
    const removed = entry.removedCapabilities.map((c) => chalk.red(`-${c}`));
    const drift = [...added, ...removed];
    return drift.length ? chalk.gray('  ') + drift.join(' ') : '';
  }
}
