export interface IAccountProfilePanelState {
  loading: boolean;
  saving: boolean;
  saved: boolean;
  error: string;
  person: Record<string, any> | null;
}
