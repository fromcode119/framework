import { Provider, state, bound } from '@fromcode119/reactor';
import { InteractiveCanvasChannel } from '@core/interactive-canvas/interactive-canvas-channel';
import type { IInteractiveCanvasContextValue } from '@core/interactive-canvas/interfaces/interactive-canvas-context-value.interface';
import type { IInteractiveCanvasState } from '@core/interactive-canvas/interfaces/interactive-canvas-state.interface';

/**
 * Reactive canvas state via `@state`, stable `@bound` mutators — replaces the functional
 * `useState`/`useCallback` provider. `channel` names the context this publishes to.
 */
export class InteractiveCanvasProvider extends Provider {
  protected readonly channel = InteractiveCanvasChannel.context;

  @state private canvasState: IInteractiveCanvasState = { isEnabled: false, targetId: null };

  @bound
  private toggleEnabled(): void {
    this.canvasState = { ...this.canvasState, isEnabled: !this.canvasState.isEnabled };
  }

  @bound
  private setTargetId(id: string | null): void {
    this.canvasState = { ...this.canvasState, targetId: id };
  }

  protected value(): IInteractiveCanvasContextValue {
    return { state: this.canvasState, toggleEnabled: this.toggleEnabled, setTargetId: this.setTargetId };
  }
}
