import { SecurityEventKind } from '@core/security/enums/security-event-kind.enum';
import { SecuritySeverity } from '@core/security/enums/security-severity.enum';

export interface ISecurityEvent {
  type: SecurityEventKind;
  pluginSlug: string;
  severity: SecuritySeverity;
  details: string;
  metadata?: any;
}
