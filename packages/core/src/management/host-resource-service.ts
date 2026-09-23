import os from 'os';
import fs from 'fs';
import { execFile } from 'child_process';
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

  /**
   * `df` first, `statfs` when there is no `df`.
   *
   * `statfs` counts blocks in FRAGMENT-size units, but Node exposes only the preferred I/O size
   * (`bsize`), not the fragment size. On most local filesystems the two are equal. On a bind mount from
   * Docker Desktop, and on FUSE, NFS or virtiofs volumes, they are not: the uploads mount reported
   * `bsize` 1 MiB over 4 KiB blocks, and the dashboard showed a laptop's 971 GB disk as 232 TB.
   * `df -P` answers in 1 KiB units whatever the filesystem, so it is the one read that is always right.
   */
  private static async statfsOrNull(path: string): Promise<Record<string, unknown> | null> {
    const fromDf = await HostResourceService.dfOrNull(path);
    if (fromDf) return fromDf;
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

  private static dfOrNull(path: string): Promise<Record<string, unknown> | null> {
    return new Promise((resolve) => {
      execFile('df', ['-Pk', path], { timeout: 2000 }, (error, stdout) => {
        if (error) {
          HostResourceService.logger.debug(`df unavailable for ${path}: ${error.message}`);
          resolve(null);
          return;
        }
        resolve(HostResourceService.parseDf(path, String(stdout)));
      });
    });
  }

  /** The data line of `df -Pk`: filesystem, total, used, available, capacity, mount — in KiB. */
  static parseDf(path: string, output: string): Record<string, unknown> | null {
    const line = output.trim().split('\n')[1];
    if (!line) return null;
    // Anchored on the capacity column (`85%`): the filesystem name and the mount path can both hold
    // spaces, so counting from either end is wrong for one of them.
    const fields = line.trim().split(/\s+/);
    const capacity = fields.findIndex((field, index) => index >= 4 && /^\d+%$/.test(field));
    if (capacity < 0) return null;
    const totalKib = Number(fields[capacity - 3]);
    const availableKib = Number(fields[capacity - 1]);
    if (!Number.isFinite(totalKib) || !Number.isFinite(availableKib) || totalKib <= 0) return null;
    const totalBytes = totalKib * 1024;
    const freeBytes = availableKib * 1024;
    return { path, totalBytes, freeBytes, usedBytes: totalBytes - freeBytes };
  }
}
