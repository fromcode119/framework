/**
 * Does the edit form differ from the record as it was loaded?
 *
 * The save bar used to assert "Unsaved changes to <collection>" **unconditionally** — it was rendered
 * whenever the page was, with no dirty state anywhere in the edit stack to gate it. So a freshly
 * opened, untouched record announced unsaved work on every collection, every time. A permanent warning
 * is not a warning; it also hides the one case that matters, because nothing about the bar changes when
 * the operator actually does edit something.
 *
 * The comparison is against a PRISTINE SNAPSHOT taken at load (and refreshed after each successful
 * save), not a flag flipped by the change handlers. `setFormData` is handed to plugin slot/field
 * components, some of which write during mount — a flag would latch on those writes and report a change
 * the operator never made. Comparing values reports a change only when the data genuinely differs, no
 * matter who wrote it.
 */
export class CollectionEditDirtyState {
  /**
   * A NEW entry is always unsaved — nothing exists on the server yet, so the whole form is pending.
   * With no snapshot (the record never loaded, or the load failed) nothing is claimed: an error state
   * must not also accuse the operator of holding unsaved edits.
   */
  static isDirty(formData: unknown, pristine: unknown, isNew: boolean): boolean {
    if (isNew) return true;
    if (!pristine) return false;
    return !CollectionEditDirtyState.equal(formData, pristine);
  }

  /**
   * Structural equality over form values (JSON-shaped: primitives, arrays, plain objects).
   *
   * `null` and `undefined` compare equal so that a key the server omits and a key the form initialises
   * to `undefined` are not reported as an edit — that difference is an artefact of the wire format, not
   * something the operator did. Everything else compares strictly, so a real change is never swallowed.
   */
  private static equal(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a === null || a === undefined || b === null || b === undefined) return a == null && b == null;

    if (Array.isArray(a) || Array.isArray(b)) {
      if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
      return a.every((item, index) => CollectionEditDirtyState.equal(item, b[index]));
    }

    // Shape discrimination on arbitrary JSON values, not a defensive guard against a framework contract.
    if (typeof a === 'object' && typeof b === 'object') {
      const left = a as Record<string, unknown>;
      const right = b as Record<string, unknown>;
      const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
      for (const key of keys) {
        if (!CollectionEditDirtyState.equal(left[key], right[key])) return false;
      }
      return true;
    }

    return false;
  }
}
