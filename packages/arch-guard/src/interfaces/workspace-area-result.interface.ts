import type { IWorkspaceSlugResult } from './workspace-slug-result.interface';

/** One area's typecheck outcome: its total and the per-extension breakdown behind it. */
export interface IWorkspaceAreaResult {
  area: string;
  total: number;
  perSlug: IWorkspaceSlugResult[];
}
