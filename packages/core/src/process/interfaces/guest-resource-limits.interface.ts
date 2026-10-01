/**
 * What one guest process may use of the machine it shares with every site's other processes. The api
 * decides these (from the platform settings, for the plugins a site uploaded); the process that starts
 * the guest enforces them (`GuestResourceWatchdog`).
 */
export interface IGuestResourceLimits {
  /** Share of ONE core, in percent, averaged over the watchdog's window. */
  cpuPercent: number;
  /** Resident memory in MB — the whole process, not only the V8 heap `--max-old-space-size` caps. */
  memoryMb: number;
  /** Everything its user owns on disk, in MB (`GuestDiskUsage`). */
  diskMb: number;
  /** Processes and threads its user may run at once (`RLIMIT_NPROC`, set by `GuestLaunchCommand`). */
  maxTasks: number;
}
