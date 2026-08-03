import { Enum } from '@fromcode119/reactor';

/** Health of the API connection shown in the admin header. */
export class ApiStatus extends Enum {
  static readonly LOADING = new ApiStatus('loading');
  static readonly ONLINE = new ApiStatus('online');
  static readonly OFFLINE = new ApiStatus('offline');

  private constructor(value: string) {
    super(value);
  }
}
