export interface InteractiveCanvasState {
  isEnabled: boolean;
  targetId: string | null;
}

export interface InteractiveCanvasContextValue {
  state: InteractiveCanvasState;
  toggleEnabled: () => void;
  setTargetId: (id: string | null) => void;
}
