export interface IAccountSessionsPanelState {
  loading: boolean;
  revoking: boolean;
  revokingId: string;
  error: string;
  sessions: any[];
}
