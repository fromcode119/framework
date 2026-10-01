import fs from 'fs';
import type { IGuestResourceLimits } from '@core/process/interfaces/guest-resource-limits.interface';

import type { IGuestResourceTarget } from '@core/process/interfaces/guest-resource-target.interface';
import { GuestDiskUsage } from '@core/process/guest-disk-usage';

/**
 * Stops a guest process that takes more than its share of the machine.
 *
 * Every plugin process of every site runs on the same few cores and in the same memory. A heap ceiling
 * (`--max-old-space-size`) bounds only V8's heap — a Buffer, a native module or a worker thread lives
 * outside it — and a request deadline stops only work a request started: a loop a plugin runs on its
 * own timer answers every call on time and still holds a core for good. So the process that started
 * the guest samples it from `/proc` and stops it once it holds a core past the limit for a whole window,
 * or its resident memory passes the limit. Its api sees an ordinary exit and restarts it with backoff,
 * and disables it after its restarts are spent — with the reason in the plugin's log.
 *
 * Linux only: where `/proc` is absent (a developer's macOS) nothing is watched, and `watch` says so.
 */
export class GuestResourceWatchdog {
  static readonly SAMPLE_MS = 5_000;
  /** Samples a CPU average spans: 6 × 5 s — a burst of real work passes, a process pinned at 100 % does not. */
  static readonly WINDOW_SAMPLES = 6;
  /** `USER_HZ`: the unit of `/proc/<pid>/stat` CPU times. Fixed at 100 by the kernel ABI on every architecture Linux ships. */
  static readonly TICKS_PER_SECOND = 100;
  /** Disk is walked every second sample (10 s): a filesystem walk costs more than reading `/proc`. */
  static readonly DISK_EVERY = 2;

  constructor(
    private readonly read: (target: IGuestResourceTarget) => { cpuTicks: number; rssMb: number } | null = GuestResourceWatchdog.readProc,
    private readonly sampleMs = GuestResourceWatchdog.SAMPLE_MS,
    private readonly now: () => number = Date.now,
    private readonly measureDisk: (uid: number, dirs: string[]) => { bytes: number; files: number } = GuestDiskUsage.measure,
  ) {}

  static isSupported(): boolean {
    return fs.existsSync('/proc/self/stat');
  }

  /**
   * Watches a guest until it exits or breaks a limit; `onBreach` is told why, once. Returns the stop.
   * With a `uid` — every guest the spawner starts has its own — the usage counted is that of EVERY
   * process running as that user, so work a plugin hands to a process of its own counts as its own.
   */
  watch(target: IGuestResourceTarget, limits: IGuestResourceLimits, onBreach: (reason: string) => void): () => void {
    const samples: Array<{ at: number; cpuTicks: number }> = [];
    let ticks = 0;
    let stopped = false;
    const stop = () => {
      stopped = true;
      clearInterval(timer);
    };
    const timer = setInterval(() => {
      if (stopped) return;
      const usage = this.read(target);
      if (!usage) return stop();
      if (limits.memoryMb > 0 && usage.rssMb > limits.memoryMb) {
        stop();
        return onBreach(`used ${Math.round(usage.rssMb)} MB of memory; the limit for this plugin is ${limits.memoryMb} MB`);
      }
      ticks += 1;
      const disk = limits.diskMb > 0 && target.uid !== undefined && target.uid !== null && ticks % GuestResourceWatchdog.DISK_EVERY === 0
        ? this.measureDisk(target.uid, target.dirs ?? [])
        : null;
      if (disk && disk.files > GuestDiskUsage.MAX_FILES) {
        stop();
        return onBreach(`kept more than ${GuestDiskUsage.MAX_FILES} files on disk`);
      }
      if (disk && disk.bytes > limits.diskMb * 1024 * 1024) {
        stop();
        return onBreach(`stored ${Math.round(disk.bytes / (1024 * 1024))} MB on disk; the limit for this plugin is ${limits.diskMb} MB`);
      }
      samples.push({ at: this.now(), cpuTicks: usage.cpuTicks });
      // WINDOW_SAMPLES intervals need one sample more than that to measure.
      if (samples.length > GuestResourceWatchdog.WINDOW_SAMPLES + 1) samples.shift();
      if (samples.length <= GuestResourceWatchdog.WINDOW_SAMPLES) return;
      const first = samples[0];
      const last = samples[samples.length - 1];
      const seconds = (last.at - first.at) / 1000;
      if (seconds <= 0) return;
      const percent = ((last.cpuTicks - first.cpuTicks) / GuestResourceWatchdog.TICKS_PER_SECOND / seconds) * 100;
      if (limits.cpuPercent > 0 && percent > limits.cpuPercent) {
        stop();
        onBreach(`kept ${Math.round(percent)}% of a CPU core busy for ${Math.round(seconds)} s; the limit for this plugin is ${limits.cpuPercent}%`);
      }
    }, this.sampleMs);
    timer.unref();
    return stop;
  }

  /** CPU time (user + system, all threads) and resident memory of a guest, or null once its process is gone. */
  static readProc(target: IGuestResourceTarget): { cpuTicks: number; rssMb: number } | null {
    const own = GuestResourceWatchdog.readPid(target.pid);
    if (!own) return null;
    if (target.uid === undefined || target.uid === null) return { cpuTicks: own.cpuTicks, rssMb: own.rssMb };
    let cpuTicks = 0;
    let rssMb = 0;
    for (const pid of GuestResourceWatchdog.pidsOf(target.uid)) {
      const usage = GuestResourceWatchdog.readPid(pid);
      if (!usage) continue;
      cpuTicks += usage.cpuTicks;
      rssMb += usage.rssMb;
    }
    return { cpuTicks, rssMb };
  }

  /** Every live process running as `uid`. */
  static pidsOf(uid: number): number[] {
    const pids: number[] = [];
    let entries: string[] = [];
    try { entries = fs.readdirSync('/proc'); } catch { return pids; }
    for (const entry of entries) {
      if (!/^\d+$/.test(entry)) continue;
      const usage = GuestResourceWatchdog.readPid(Number(entry));
      if (usage && usage.uid === uid) pids.push(Number(entry));
    }
    return pids;
  }

  private static readPid(pid: number): { cpuTicks: number; rssMb: number; uid: number } | null {
    try {
      const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
      // The command name is in parentheses and may itself hold spaces or parentheses: fields start after the LAST ')'.
      const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
      // Field 3 (state) is fields[0], so utime (14) and stime (15) are fields[11] and fields[12].
      const cpuTicks = Number(fields[11]) + Number(fields[12]);
      const status = fs.readFileSync(`/proc/${pid}/status`, 'utf8');
      const rssKb = Number(/^VmRSS:\s+(\d+)\s+kB/m.exec(status)?.[1] ?? 0);
      const uid = Number(/^Uid:\s+(\d+)/m.exec(status)?.[1] ?? -1);
      if (!Number.isFinite(cpuTicks)) return null;
      return { cpuTicks, rssMb: rssKb / 1024, uid };
    } catch {
      return null;
    }
  }
}
