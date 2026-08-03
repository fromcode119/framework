import { Enum } from '@fromcode119/reactor';

/** Assistant layout viewport. */
export class AssistantViewport extends Enum {
  static readonly DESKTOP = new AssistantViewport('desktop');
  static readonly MOBILE = new AssistantViewport('mobile');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a wire/stored string to a member; defaults to DESKTOP. */
  static resolve(value: unknown): AssistantViewport {
    if (value instanceof AssistantViewport) return value;
    const found = AssistantViewport.fromValue(String(value ?? '').trim());
    return (found as unknown as AssistantViewport | undefined) ?? AssistantViewport.DESKTOP;
  }
}
