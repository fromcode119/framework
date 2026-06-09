import { SdkClient } from '@fromcode119/core/client';

/**
 * Resolves the framework auth scope client (`/api/v1/auth/*`) from the plugin runtime api client.
 * The SDK client owns the base URL and CSRF injection, so account panels never touch raw fetch,
 * hardcoded paths or cookies.
 */
export class AccountAuthClient {
  static of(api: any): any {
    return new SdkClient(api).getAuth();
  }

  /** Best-effort human-readable message from a thrown api-client error. */
  static errorMessage(error: any, fallback: string): string {
    return String(
      error?.response?.data?.error
        || error?.data?.error
        || error?.body?.error
        || error?.message
        || fallback,
    );
  }
}
