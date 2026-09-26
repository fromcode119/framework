import os from 'os';
import fs from 'fs';

/**
 * Whether the box has room to run a second copy of each app while it is swapped.
 *
 * A rolling deploy replaces one app at a time, so the peak extra memory is the largest single app, not
 * the sum. That app's current use (plus a margin, because a booting process is briefly larger than a
 * settled one) must fit in what the box has AVAILABLE, with a reserve left over for everything else.
 * Pure: it only reads the two texts it is given, so it is decided the same way on the box and in a test.
 */
export class DeployCapacity {
  /** A booting app briefly holds more than a settled one. */
  static readonly BOOT_MARGIN = 1.25;

  /** Left free after the overlap, for the database, the gateway and the kernel. */
  static readonly RESERVE_BYTES = 512 * 1024 * 1024;

  private static readonly UNITS: Record<string, number> = { B: 1, KIB: 1024, MIB: 1024 ** 2, GIB: 1024 ** 3, KB: 1000, MB: 1000 ** 2, GB: 1000 ** 3 };

  constructor(
    readonly availableBytes: number,
    readonly neededBytes: number,
    readonly largestService: string,
  ) {}

  get fits(): boolean {
    return this.availableBytes - this.neededBytes >= DeployCapacity.RESERVE_BYTES;
  }

  describe(): string {
    const gb = (bytes: number) => `${(bytes / 1024 ** 3).toFixed(1)} GB`;
    return `rolling needs about ${gb(this.neededBytes)} spare while ${this.largestService} is swapped; ${gb(this.availableBytes)} is available`
      + ` (${gb(DeployCapacity.RESERVE_BYTES)} kept in reserve)`;
  }

  /**
   * `free -b` gives the box's available memory; `docker stats --no-stream --format '{{.Name}}|{{.MemUsage}}'`
   * gives each container's use. Only the swapped apps count.
   */
  static from(freeOutput: string, statsOutput: string, services: readonly string[]): DeployCapacity {
    const memLine = freeOutput.split('\n').find((line) => line.trim().startsWith('Mem:')) ?? '';
    const available = Number(memLine.trim().split(/\s+/)[6] ?? 0) || 0;
    let largest = 0;
    let largestService = services[0] ?? '';
    for (const line of statsOutput.split('\n')) {
      const [name, usage] = line.split('|');
      const service = services.find((candidate) => new RegExp(`[-_]${candidate}[-_]\\d+$`).test(String(name ?? '').trim()));
      if (!service) continue;
      const bytes = DeployCapacity.bytes(String(usage ?? '').split('/')[0]);
      if (bytes > largest) { largest = bytes; largestService = service; }
    }
    return new DeployCapacity(available, Math.round(largest * DeployCapacity.BOOT_MARGIN), largestService);
  }

  /**
   * The same verdict from inside the api container, for the admin: the box's available memory, and the
   * api's own container use (its cgroup, which includes every plugin process). The api is the largest
   * app by far, so it is the one the overlap has to fit.
   */
  static forThisContainer(): DeployCapacity {
    const used = DeployCapacity.cgroupBytes() ?? process.memoryUsage().rss;
    return new DeployCapacity(os.freemem(), Math.round(used * DeployCapacity.BOOT_MARGIN), 'api');
  }

  /** cgroup v2 `memory.current`, else v1 `memory.usage_in_bytes`; null outside a container. */
  private static cgroupBytes(): number | null {
    for (const file of ['/sys/fs/cgroup/memory.current', '/sys/fs/cgroup/memory/memory.usage_in_bytes']) {
      try {
        const value = Number(fs.readFileSync(file, 'utf8').trim());
        if (value > 0) return value;
      } catch {
        // Not this cgroup version, or not in a container.
      }
    }
    return null;
  }

  /** `2.016GiB`, `512MiB`, `83.5MB` → bytes. */
  static bytes(text: string): number {
    const match = String(text ?? '').trim().match(/^([\d.]+)\s*([a-z]+)$/i);
    if (!match) return 0;
    return Number(match[1]) * (DeployCapacity.UNITS[match[2].toUpperCase()] ?? 0);
  }
}
