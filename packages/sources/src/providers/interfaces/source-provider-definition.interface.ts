/**
 * What a provider IS, for the admin that has to offer it.
 *
 * The labels live here rather than in the screen, so adding a provider does not mean editing a
 * dropdown somewhere else — the form is built from this list, the way the collection options are.
 */
export interface ISourceProviderDefinition {
  /** Stored on every source row. Never displayed; `label` is. */
  key: string;
  label: string;
  /** One line, shown under the provider field so the choice is not made from the key alone. */
  description: string;
  /** What the operator types in to point at a source — "Repository URL" for git. */
  locationLabel: string;
  locationPlaceholder: string;
  /** What a version is called here: a branch, a tag, a release. */
  refLabel: string;
  /** Whether this provider can take a credential at all. */
  supportsSecret: boolean;
  /** Shown under the credential field when it does. */
  secretLabel?: string;
}
