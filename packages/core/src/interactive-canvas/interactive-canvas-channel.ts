import { Context } from '@fromcode119/reactor';
import type { IInteractiveCanvasContextValue } from '@core/interactive-canvas/interfaces/interactive-canvas-context-value.interface';

/**
 * The context the canvas provider publishes on and its wrapper/consumer read from.
 *
 * Its own file because three components share it — importing it from any one of them would make that
 * component the de-facto owner of the channel.
 */
export class InteractiveCanvasChannel {
  static readonly context = new Context<IInteractiveCanvasContextValue | undefined>(undefined);
}
