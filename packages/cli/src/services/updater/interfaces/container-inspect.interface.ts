/** The container inspection fields the updater reads; the rest is carried through untouched. */
export interface IContainerInspect {
  Id: string;
  Name: string;
  State: { Running: boolean; Restarting?: boolean; Status?: string };
  /** How often Docker restarted it under its restart policy. */
  RestartCount?: number;
  Config: Record<string, any>;
  HostConfig: Record<string, any>;
  NetworkSettings: { Networks: Record<string, Record<string, any>> };
}
