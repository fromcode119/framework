import type { IScimName } from '@api/services/interfaces/scim-name.interface';
import type { IScimEmail } from '@api/services/interfaces/scim-email.interface';

export interface IScimUser {
  schemas: string[];
  id: string;
  userName: string;
  name: IScimName;
  emails: IScimEmail[];
  active: boolean;
  meta: { resourceType: string };
}
