export interface BrowserCookieOptions {
  domain?: string;
  maxAgeSeconds?: number;
  path?: string;
  sameSite?: 'lax' | 'strict' | 'none';
  secure?: boolean;
}
