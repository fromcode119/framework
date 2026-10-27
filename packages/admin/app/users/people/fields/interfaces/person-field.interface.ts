/** A person field as the api returns it (`GET /admin/people/fields`). */
export interface IPersonFieldDefinition {
  key: string;
  label: Record<string, string>;
  type: string;
  options: Array<{ key: string; label: Record<string, string> }>;
  description: Record<string, string>;
  selfEditable: boolean;
  sortOrder: number;
}

export type PersonFieldAnswer = string | number | boolean | string[] | null;
