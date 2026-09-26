import { Enum } from '@fromcode119/react-class-components/lang';

/**
 * Which of a guest's two output streams a line came from.
 *
 * Node's words, but OUR signature: `IGuestProcess.onOutput` is the framework's, and every launcher
 * implements it. Named rather than spelled inline at each one, because a listener that tests for a
 * mistyped stream never fires and never complains — the plugin's errors would simply stop appearing,
 * which is the worst way for a log to fail.
 */
export class GuestOutputStream extends Enum {
  /** Ordinary output. */
  static readonly STDOUT = new GuestOutputStream('stdout');

  /** Where a crashing guest says why. */
  static readonly STDERR = new GuestOutputStream('stderr');

  private constructor(value: string) {
    super(value);
  }
}
