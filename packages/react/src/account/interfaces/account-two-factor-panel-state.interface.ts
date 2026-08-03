export interface IAccountTwoFactorPanelState {
  loading: boolean;
  busy: boolean;
  enabled: boolean;
  setupSecret: string;
  qrCode: string;
  recoveryCodes: string[];
  token: string;
  message: string;
  isError: boolean;
}
