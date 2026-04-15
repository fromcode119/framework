import { Request } from 'express';

export class RequestCookieService {
  hasCookie(req: Request, name: string): boolean {
    return this.collectCookieValues(req, name).length > 0;
  }

  readPrimaryCookieValue(req: Request, name: string): string {
    return this.collectCookieValues(req, name)[0] || '';
  }

  collectCookieValues(req: Request, name: string): string[] {
    const normalizedName = String(name || '').trim();
    if (!normalizedName) {
      return [];
    }

    const values: string[] = [];
    const rawHeader = String(req.headers?.cookie || '');

    if (rawHeader) {
      rawHeader.split(';').forEach((cookieChunk) => {
        const parts = cookieChunk.trim().split('=');
        if (parts.length < 2) {
          return;
        }

        const cookieName = parts[0].trim();
        const cookieValue = parts.slice(1).join('=').trim();
        if (cookieName === normalizedName && cookieValue && !values.includes(cookieValue)) {
          values.push(cookieValue);
        }
      });
    }

    const cookieStore = req.cookies?.[normalizedName];
    if (Array.isArray(cookieStore)) {
      cookieStore.forEach((value) => {
        const normalizedValue = String(value || '').trim();
        if (normalizedValue && !values.includes(normalizedValue)) {
          values.push(normalizedValue);
        }
      });
      return values;
    }

    const normalizedCookieValue = String(cookieStore || '').trim();
    if (normalizedCookieValue && !values.includes(normalizedCookieValue)) {
      values.push(normalizedCookieValue);
    }

    return values;
  }
}