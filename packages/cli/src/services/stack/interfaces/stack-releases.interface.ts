/** The releases whose images can be pulled. */
export interface IStackReleases {
  /** True when every one of these images is published under `tag`. */
  isPublished(images: readonly string[], tag: string): Promise<boolean>;
  /** The newest release that is complete here or in the registry, or null when none can be read. */
  latest(images: readonly string[], local: readonly string[]): Promise<string | null>;
}
