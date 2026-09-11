import os from 'os';
import fs from 'fs';
import { Logger } from '@core/logging';
import { ProjectPaths } from '@core/config/paths';

/**
 * What the machine this installation runs on is actually doing: memory, CPU load, disk, uptime.
 *
 * Every number here is MEASURED — `os` for the host, `statfs` for the filesystem holding the data
 * directory, `process` for this Node instance. Nothing is a configured ceiling the operator never
 * set, and a figure the platform cannot obtain is reported as `null` rather than 0: a disk that
 * cannot be stat'd is unknown, and "unknown" and "empty" must not look the same on a dashboard.
 *
 * Inside a container these are the CONTAINER's limits when the runtime enforces them and the HOST's
 * otherwise — Node reads the same cgroup the kernel gives it. The admin says which it is showing by
 * naming the host, so the figure is never presented as something it is not.
 */
export class HostResourceService {
  private static readonly logger = new Logger({ namespace: 'host-resources' });

  static async read(): Promise<Record<string, unknown>> {
    const totalMemoryBytes = os.totalmem();
    const freeMemoryBytes = os.freemem();
    const cpus = os.cpus() || [];
    const [load1, load5, load15] = os.loadavg();

    return {
      host: {
        hostname: os.hostname(),
        platform: `${os.type()} ${os.release()}`,
        uptimeSeconds: Math.round(os.uptime()),
      },
      memory: {
        totalBytes: totalMemoryBytes,
        freeBytes: freeMemoryBytes,
        usedBytes: totalMemoryBytes - freeMemoryBytes,
        /** This Node process alone, which is the part an operator can act on by restarting it. */
        processResidentBytes: process.memoryUsage().rss,
      },
      cpu: {
        cores: cpus.length,
        model: cpus[0]?.model?.trim() || '',
        /**
         * Load average is a QUEUE LENGTH, not a percentage: on a 4-core box a 1-minute load of 4.0
         * means fully busy, and 8.0 means twice as much work as cores. The admin divides by `cores`
         * rather than printing a number nobody can read without knowing the core count. On Windows
         * the OS supplies no load average and Node returns zeros — reported as null, not "idle".
         */
        load1: HostResourceService.loadOrNull(load1),
        load5: HostResourceService.loadOrNull(load5),
        load15: HostResourceService.loadOrNull(load15),
      },
      disk: await HostResourceService.readDisk(),
      process: {
        uptimeSeconds: Math.round(process.uptime()),
        nodeVersion: process.version,
      },
    };
  }

  /** Zeros across all three windows is Windows' "no such metric", not an idle machine. */
  private static loadOrNull(value: number): number | null {
    return Number.isFinite(value) && os.loadavg().some((entry) => entry > 0) ? Number(value.toFixed(2)) : null;
  }

  /**
   * The filesystem holding the uploads directory — the one that fills up and takes the platform down
   * with it, since media and backups grow there rather than beside the code.
   *
   * Tried in order, because the first candidate can legitimately not exist yet: under multi-tenancy
   * `getUploadsDir()` appends the CURRENT tenant's subdirectory, and a tenant that has never had an
   * upload has no folder — `statfs` then fails with ENOENT and the dashboard showed "unknown" on a
   * perfectly healthy disk. Every candidate is on the same volume in the shipped deployment, so the
   * numbers do not change; only whether they can be read at all does.
   */
  private static async readDisk(): Promise<Record<string, unknown> | null> {
    for (const path of [ProjectPaths.getUploadsDir(), ProjectPaths.getProjectRoot(), '/']) {
      const usage = await HostResourceService.statfsOrNull(path);
      if (usage) return usage;
    }
    return null;
  }

  private static async statfsOrNull(path: string): Promise<Record<string, unknown> | null> {
    try {
      const stats = await fs.promises.statfs(path);
      const totalBytes = stats.blocks * stats.bsize;
      const freeBytes = stats.bavail * stats.bsize;
      if (!totalBytes) return null;
      return { path, totalBytes, freeBytes, usedBytes: totalBytes - freeBytes };
    } catch (error) {
      HostResourceService.logger.debug(`Disk usage unavailable for ${path}: ${error}`);
      return null;
    }
  }
}
