import { spawn } from 'child_process';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GuestResourceWatchdog } from '@core/process/guest-resource-watchdog';

describe('GuestResourceWatchdog', () => {
  afterEach(() => vi.useRealTimers());

  /** A process whose CPU clock advances `percent` of a core per second, at a steady resident size. */
  const guest = (percent: number, rssMb = 50) => {
    let clock = 0;
    const read = vi.fn(() => ({ cpuTicks: (clock / 1000) * (percent / 100) * GuestResourceWatchdog.TICKS_PER_SECOND, rssMb }));
    return { read, now: () => clock, advance: (ms: number) => { clock += ms; vi.advanceTimersByTime(ms); } };
  };

  it('stops a process that keeps a core busy past its share for a whole window', () => {
    vi.useFakeTimers();
    const g = guest(100);
    const onBreach = vi.fn();
    new GuestResourceWatchdog(g.read, 5_000, g.now).watch({ pid: 1 }, { cpuPercent: 50, memoryMb: 0, diskMb: 0, maxTasks: 0 }, onBreach);
    for (let i = 0; i < GuestResourceWatchdog.WINDOW_SAMPLES; i += 1) g.advance(5_000);
    expect(onBreach).not.toHaveBeenCalled();
    g.advance(5_000);
    expect(onBreach).toHaveBeenCalledTimes(1);
    expect(onBreach.mock.calls[0][0]).toMatch(/kept 100% of a CPU core busy for 30 s; the limit for this plugin is 50%/);
  });

  it('leaves a process under its share alone, however long it runs', () => {
    vi.useFakeTimers();
    const g = guest(40);
    const onBreach = vi.fn();
    new GuestResourceWatchdog(g.read, 5_000, g.now).watch({ pid: 1 }, { cpuPercent: 50, memoryMb: 0, diskMb: 0, maxTasks: 0 }, onBreach);
    for (let i = 0; i < 60; i += 1) g.advance(5_000);
    expect(onBreach).not.toHaveBeenCalled();
  });

  it('stops a process at once when its whole resident memory passes the limit', () => {
    vi.useFakeTimers();
    const g = guest(0, 900);
    const onBreach = vi.fn();
    new GuestResourceWatchdog(g.read, 5_000, g.now).watch({ pid: 1 }, { cpuPercent: 50, memoryMb: 384, diskMb: 0, maxTasks: 0 }, onBreach);
    g.advance(5_000);
    expect(onBreach).toHaveBeenCalledWith(expect.stringMatching(/used 900 MB of memory; the limit for this plugin is 384 MB/));
  });

  it('stops a plugin past its disk, measured every second sample and only for a guest with a user of its own', () => {
    vi.useFakeTimers();
    const g = guest(0);
    const measure = vi.fn(() => ({ bytes: 150 * 1024 * 1024, files: 12 }));
    const onBreach = vi.fn();
    new GuestResourceWatchdog(g.read, 5_000, g.now, measure).watch({ pid: 1, uid: 20024, dirs: ['/app/data/plugins/x'] }, { cpuPercent: 50, memoryMb: 384, diskMb: 100, maxTasks: 64 }, onBreach);
    g.advance(5_000);
    expect(measure).not.toHaveBeenCalled();
    g.advance(5_000);
    expect(measure).toHaveBeenCalledWith(20024, ['/app/data/plugins/x']);
    expect(onBreach).toHaveBeenCalledWith('stored 150 MB on disk; the limit for this plugin is 100 MB');
  });

  it('stops a plugin that keeps too many files, whatever their size', () => {
    vi.useFakeTimers();
    const g = guest(0);
    const onBreach = vi.fn();
    new GuestResourceWatchdog(g.read, 5_000, g.now, () => ({ bytes: 10, files: 100_001 })).watch({ pid: 1, uid: 20024 }, { cpuPercent: 50, memoryMb: 384, diskMb: 100, maxTasks: 64 }, onBreach);
    g.advance(10_000);
    expect(onBreach).toHaveBeenCalledWith('kept more than 100000 files on disk');
  });

  it('does not measure disk for a guest without a user of its own', () => {
    vi.useFakeTimers();
    const g = guest(0);
    const measure = vi.fn(() => ({ bytes: 0, files: 0 }));
    new GuestResourceWatchdog(g.read, 5_000, g.now, measure).watch({ pid: 1 }, { cpuPercent: 50, memoryMb: 384, diskMb: 100, maxTasks: 64 }, vi.fn());
    g.advance(30_000);
    expect(measure).not.toHaveBeenCalled();
  });

  it('stops watching once the process is gone, and reports nothing', () => {
    vi.useFakeTimers();
    const read = vi.fn(() => null);
    const onBreach = vi.fn();
    new GuestResourceWatchdog(read, 5_000).watch({ pid: 1 }, { cpuPercent: 50, memoryMb: 384, diskMb: 0, maxTasks: 0 }, onBreach);
    for (let i = 0; i < 5; i += 1) vi.advanceTimersByTime(5_000);
    expect(read).toHaveBeenCalledTimes(1);
    expect(onBreach).not.toHaveBeenCalled();
  });

  it.skipIf(!GuestResourceWatchdog.isSupported())('measures a real process that holds a core, and flags it within a window', async () => {
    const busy = spawn(process.execPath, ['-e', 'for (;;) {}'], { stdio: 'ignore' });
    try {
      const reason = await new Promise<string>((resolve, reject) => {
        const deadline = setTimeout(() => reject(new Error('the watchdog never flagged a process pinned at 100%')), 10_000);
        new GuestResourceWatchdog(GuestResourceWatchdog.readProc, 200).watch({ pid: busy.pid! }, { cpuPercent: 50, memoryMb: 0, diskMb: 0, maxTasks: 0 }, (why) => {
          clearTimeout(deadline);
          resolve(why);
        });
      });
      expect(reason).toMatch(/kept (9\d|1\d\d)% of a CPU core busy/);
    } finally {
      busy.kill('SIGKILL');
    }
  });

  it.skipIf(!GuestResourceWatchdog.isSupported())('reads CPU and memory of a real process from /proc', () => {
    const usage = GuestResourceWatchdog.readProc({ pid: process.pid });
    expect(usage?.rssMb).toBeGreaterThan(10);
    expect(usage?.cpuTicks).toBeGreaterThan(0);
    expect(GuestResourceWatchdog.pidsOf(process.getuid!())).toContain(process.pid);
  });
});
