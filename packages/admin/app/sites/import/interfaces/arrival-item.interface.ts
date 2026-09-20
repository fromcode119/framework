/** One tile under "You get": a count and the human thing it counts. */
export interface IArrivalItem {
  key: string;
  count: number;
  label: string;
  /** A record of what happened — counted, but never named first. */
  isJournal: boolean;
}
