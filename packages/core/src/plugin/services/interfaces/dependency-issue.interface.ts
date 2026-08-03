import { DependencyIssueKind } from '@core/plugin/services/enums/dependency-issue-kind.enum';

export interface IDependencyIssue {
  slug: string;
  expected: string;
  actual?: string;
  type: DependencyIssueKind;
}
