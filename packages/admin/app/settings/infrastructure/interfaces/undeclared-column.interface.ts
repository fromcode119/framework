/** A column the database holds that nothing declares, as the schema review lists it. */
export interface IUndeclaredColumn {
  table: string;
  column: string;
  /** Absent when the rows could not be counted — never read as zero. */
  rows?: number;
  nonEmpty?: number;
  sample?: string;
  firstSeenAt: string;
  inactivePluginsAtScan?: string[];
}
