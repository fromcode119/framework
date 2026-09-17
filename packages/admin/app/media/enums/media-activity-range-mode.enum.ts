import { Enum } from '@fromcode119/react-class-components';

/**
 * How the media-activity window is expressed.
 *
 * `PRESET` is a rolling number of days; `CUSTOM` is an explicit from/to pair. The two cannot be
 * merged: a custom range silently reinterpreted as "the last N days" would answer a different
 * question than the operator asked, with no sign that it had.
 */
export class MediaActivityRangeMode extends Enum {
  /** A rolling window — the last N days. */
  static readonly PRESET = new MediaActivityRangeMode('preset');

  /** An explicit from/to pair. */
  static readonly CUSTOM = new MediaActivityRangeMode('custom');

  private constructor(value: string) {
    super(value);
  }
}
