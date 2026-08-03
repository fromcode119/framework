import type { IInteractiveCanvasState } from '@core/interactive-canvas/interfaces/interactive-canvas-state.interface';

export interface IInteractiveCanvasContextValue {
  state: IInteractiveCanvasState;
  toggleEnabled: () => void;
  setTargetId: (id: string | null) => void;
}
