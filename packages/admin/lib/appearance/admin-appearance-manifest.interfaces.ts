/**
 * Descriptor for one selectable admin appearance — the built-in default, or an additional appearance that
 * ships in admin-appearances/<slug>/. The presentation bundle is resolved separately; this is only the
 * descriptor used for registration and selection.
 */
export interface AdminAppearanceManifest {
  /** Stable unique id, e.g. 'default' or 'simple'. Matches admin-appearances/<id>/ for additional appearances. */
  readonly id: string;
  /** Human-readable label shown in admin appearance pickers. */
  readonly label: string;
  /** Optional one-line description. */
  readonly description?: string;
}
