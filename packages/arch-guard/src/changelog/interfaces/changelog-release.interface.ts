/** One released (or about-to-be-released) version and the commit subjects that went into it. */
export interface IChangelogRelease {
  version: string;
  /** `YYYY-MM-DD`. */
  date: string;
  subjects: string[];
}
