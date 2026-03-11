export interface DependencyIssue {
  slug: string;
  expected: string;
  actual?: string;
  type: 'missing' | 'incompatible' | 'inactive';
}
