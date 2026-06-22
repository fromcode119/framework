export interface AppearanceInstallUrlCardProps {
  url: string;
  busy: boolean;
  onChange: (url: string) => void;
  onInstall: () => void;
}
