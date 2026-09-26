import { Enum } from '@fromcode119/react-class-components/lang';

/**
 * What a message port tells its listeners about.
 *
 * Two events, and only two: a message arrived, or the other end is gone. `IMessagePort` presents the
 * same pair whether the transport is Node IPC or a framed Unix socket — which is the point of the
 * interface — so the pair is named once here rather than at each implementation and each caller.
 */
export class MessagePortEvent extends Enum {
  /** A message arrived from the other end. */
  static readonly MESSAGE = new MessagePortEvent('message');

  /** The other end is gone. Nothing further will arrive. */
  static readonly DISCONNECT = new MessagePortEvent('disconnect');

  private constructor(value: string) {
    super(value);
  }
}
