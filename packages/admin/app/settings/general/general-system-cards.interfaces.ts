import type React from 'react';

export interface GeneralSystemCardsProps {
  settings: Record<string, any>;
  setSettings: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  theme: string;
  timezoneOptions: { label: string; value: string }[];
  isSendingTelemetryTest: boolean;
  onSendTelemetryTest: () => void;
}
