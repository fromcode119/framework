import { useContext } from 'react';
import { InteractiveCanvasChannel } from '@core/interactive-canvas/interactive-canvas-channel';
import { InteractiveCanvasProvider } from '@core/interactive-canvas/view/interactive-canvas-provider.client';
import { InteractiveCanvasWrapper } from '@core/interactive-canvas/view/interactive-canvas-wrapper.client';
import type { IInteractiveCanvasContextValue } from '@core/interactive-canvas/interfaces/interactive-canvas-context-value.interface';

/**
 * The canvas namespace: Provider, Wrapper, a render-prop Consumer, and a hook accessor.
 *
 * The three components live one-per-file alongside; this class only groups them so callers write
 * `InteractiveCanvas.Provider` instead of importing three modules.
 */
export class InteractiveCanvas {
  static readonly Provider = InteractiveCanvasProvider;

  static readonly Wrapper = InteractiveCanvasWrapper;

  /** Render-prop consumer for hook-free (class component) access to the canvas context. */
  static readonly Consumer = InteractiveCanvasChannel.context.raw.Consumer;

  /** For function components. Class components use `Consumer` or `static contextType`. */
  static use(): IInteractiveCanvasContextValue {
    const context = useContext(InteractiveCanvasChannel.context.raw);
    if (!context) throw new Error('InteractiveCanvas.use() must be called inside InteractiveCanvas.Provider');
    return context;
  }
}
