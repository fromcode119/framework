/** A single plugin/theme/appearance, how many type errors it holds, and the messages behind the count. */
export interface IWorkspaceSlugResult {
  slug: string;
  errors: number;
  /** The raw `tsc` diagnostic lines. A count nobody can act on is a count nobody drives down. */
  messages: string[];
}
