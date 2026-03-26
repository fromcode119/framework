export class ApiRequestError extends Error {
  readonly statusCode: number;
  readonly data: unknown;
  readonly url: string;

  constructor(message: string, statusCode: number, data: unknown, url: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.statusCode = statusCode;
    this.data = data;
    this.url = url;
  }
}
