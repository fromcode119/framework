/** The container inspection fields the updater reads; the rest is carried through untouched. */
export interface IContainerInspect {
  Id: string;
  Name: string;
  State: { Running: boolean; Status?: string };
  Config: Record<string, any>;
  HostConfig: Record<string, any>;
  NetworkSettings: { Networks: Record<string, Record<string, any>> };
}
