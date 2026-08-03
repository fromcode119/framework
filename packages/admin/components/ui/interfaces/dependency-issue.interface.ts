import { DependencyIssueType } from '@/components/ui/enums/dependency-issue-type.enum';

export interface IDependencyIssue {
  slug: string;
  expected: string;
  actual?: string;
  type: DependencyIssueType;
}
