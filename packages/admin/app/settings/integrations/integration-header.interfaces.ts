export interface IntegrationHeaderProps {
  theme: string;
  activeType: string;
  integrationOptions: Array<{ label: string; value: string }>;
  resettingStaleJs: boolean;
  onChangeType: (value: string) => void;
  onResetStaleJs: () => void;
}
