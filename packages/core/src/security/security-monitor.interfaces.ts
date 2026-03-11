export interface SecurityEvent {
  type: 'anomaly' | 'violation' | 'denial_spike';
  pluginSlug: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: string;
  metadata?: any;
}
