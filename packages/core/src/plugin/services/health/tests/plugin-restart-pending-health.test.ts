import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PluginHealthReportService } from '@core/plugin/services/health/plugin-health-report-service';
import { PluginInstalledVersionService } from '@core/plugin/services/health/plugin-installed-version-service';
import { PluginState } from '@core/plugin/services/enums/plugin-state.enum';

describe('a plugin installed under a running api', () => {
  const active = (slug: string, runningVersion?: string, installedVersion?: string | null) => ({
    slug,
    state: PluginState.ACTIVE,
    runningVersion,
    installedVersion,
  });

  it('reports a restart is pending when disk is ahead of the process', () => {
    // The production case: _system_plugins, the manifest and the release tag all read 0.1.138 while
    // the admin served the 0.1.136 form, because the api had been up since before the files changed.
    const report = PluginHealthReportService.buildReport([active('ecommerce', '0.1.136', '0.1.138')]);

    expect(report.counts.restartPending).toBe(1);
    expect(report.restartPending.map((e) => e.slug)).toEqual(['ecommerce']);
    expect(report.entries[0].restartPending).toBe(true);
  });

  it('is NOT ok while a restart is pending, even with nothing held or failing', () => {
    // The whole point is that the screen is lying about what is being served. Calling that healthy
    // repeats the lie one level up.
    const report = PluginHealthReportService.buildReport([active('ecommerce', '0.1.136', '0.1.138')]);

    expect(report.ok).toBe(false);
    expect(report.counts.held).toBe(0);
    expect(report.counts.error).toBe(0);
  });

  it('says nothing when the versions match', () => {
    const report = PluginHealthReportService.buildReport([active('ecommerce', '0.1.138', '0.1.138')]);

    expect(report.ok).toBe(true);
    expect(report.counts.restartPending).toBe(0);
    expect(report.entries[0].restartPending).toBe(false);
  });

  it('flags a DOWNGRADE on disk too — it is just as unserved as an upgrade', () => {
    const report = PluginHealthReportService.buildReport([active('ecommerce', '0.1.138', '0.1.136')]);

    expect(report.entries[0].restartPending).toBe(true);
  });

  it('stays silent when the installed version cannot be read', () => {
    // Null is "cannot tell", never "changed". Warning here would put a banner on the screen that no
    // restart could ever clear.
    expect(PluginHealthReportService.buildReport([active('x', '0.1.1', null)]).entries[0].restartPending).toBe(false);
    expect(PluginHealthReportService.buildReport([active('x', '0.1.1', undefined)]).entries[0].restartPending).toBe(false);
    expect(PluginHealthReportService.buildReport([active('x', undefined, '0.1.2')]).entries[0].restartPending).toBe(false);
  });
});

describe('PluginInstalledVersionService', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'installed-version-'));
    PluginInstalledVersionService.resetCache();
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    PluginInstalledVersionService.resetCache();
  });

  it('reads the version from the manifest beside the code', () => {
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ slug: 'x', version: '0.1.138' }));

    expect(PluginInstalledVersionService.onDisk(dir)).toBe('0.1.138');
  });

  it('answers null rather than throwing for every way it can fail', () => {
    expect(PluginInstalledVersionService.onDisk(undefined)).toBeNull();
    expect(PluginInstalledVersionService.onDisk(path.join(dir, 'nope'))).toBeNull();

    fs.writeFileSync(path.join(dir, 'manifest.json'), 'not json {');
    PluginInstalledVersionService.resetCache();
    expect(PluginInstalledVersionService.onDisk(dir)).toBeNull();

    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ slug: 'x' }));
    PluginInstalledVersionService.resetCache();
    expect(PluginInstalledVersionService.onDisk(dir)).toBeNull();

    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ slug: 'x', version: '   ' }));
    PluginInstalledVersionService.resetCache();
    expect(PluginInstalledVersionService.onDisk(dir)).toBeNull();
  });

  it('caches, so an admin screen polling health does not re-read every plugin every request', () => {
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ version: '0.1.1' }));
    expect(PluginInstalledVersionService.onDisk(dir)).toBe('0.1.1');

    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ version: '0.1.2' }));
    expect(PluginInstalledVersionService.onDisk(dir)).toBe('0.1.1');

    PluginInstalledVersionService.resetCache();
    expect(PluginInstalledVersionService.onDisk(dir)).toBe('0.1.2');
  });
});
