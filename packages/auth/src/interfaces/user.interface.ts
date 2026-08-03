/** An authenticated principal (user or API key). */
export interface IUser {
  id: string;
  email: string;
  roles: string[];
  jti?: string;
  isApiKey?: boolean;
}
