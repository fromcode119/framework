export interface ScimName {
  givenName?: string;
  familyName?: string;
}

export interface ScimEmail {
  value: string;
  primary?: boolean;
}

export interface ScimUser {
  schemas: string[];
  id: string;
  userName: string;
  name: ScimName;
  emails: ScimEmail[];
  active: boolean;
  meta: { resourceType: string };
}

export interface ScimListResponse {
  schemas: string[];
  totalResults: number;
  startIndex: number;
  itemsPerPage: number;
  Resources: ScimUser[];
}

export interface ScimError {
  schemas: string[];
  status: string;
  detail: string;
}
