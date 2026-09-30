/** A guest the watchdog measures: its process, and the user it runs as when it has one of its own. */
export interface IGuestResourceTarget {
  pid: number;
  uid?: number | null;
}
