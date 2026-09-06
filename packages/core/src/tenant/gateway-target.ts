import { Enum } from '@fromcode119/reactor';

/** Where the platform gateway sends a host: one of the three apps. */
export class GatewayTarget extends Enum {
  static readonly API = new GatewayTarget('api');
  static readonly ADMIN = new GatewayTarget('admin');
  static readonly FRONTEND = new GatewayTarget('frontend');

  private constructor(value: string) {
    super(value);
  }

  static parse(value: unknown): GatewayTarget | undefined {
    return GatewayTarget.fromValue(String(value ?? '').trim().toLowerCase()) as GatewayTarget | undefined;
  }
}
