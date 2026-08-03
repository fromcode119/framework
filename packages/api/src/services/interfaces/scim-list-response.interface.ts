import type { IScimUser } from '@api/services/interfaces/scim-user.interface';

export interface IScimListResponse {
  schemas: string[];
  totalResults: number;
  startIndex: number;
  itemsPerPage: number;
  Resources: IScimUser[];
}
