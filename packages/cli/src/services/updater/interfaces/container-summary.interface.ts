/** One container as `GET /containers/json` lists it. */
export interface IContainerSummary {
  Id: string;
  Names: string[];
  Image: string;
  State: string;
  Labels: Record<string, string>;
  /** Unix seconds; orders the containers of one service oldest first. */
  Created?: number;
}
