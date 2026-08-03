import { Enum } from '@fromcode119/reactor';

/** What the user's message is asking the admin assistant to do. */
export class RuntimeIntentKind extends Enum {
  static readonly SMALLTALK = new RuntimeIntentKind('smalltalk');
  static readonly FACTUAL_QA = new RuntimeIntentKind('factual_qa');
  static readonly HOMEPAGE_DRAFT = new RuntimeIntentKind('homepage_draft');
  static readonly REPLACE_TEXT = new RuntimeIntentKind('replace_text');
  static readonly ACTION_REQUEST = new RuntimeIntentKind('action_request');
  static readonly CHAT = new RuntimeIntentKind('chat');
  static readonly UNKNOWN = new RuntimeIntentKind('unknown');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw classifier string to a member; defaults to UNKNOWN. */
  static resolve(value: unknown): RuntimeIntentKind {
    if (value instanceof RuntimeIntentKind) return value;
    const found = RuntimeIntentKind.fromValue(String(value ?? '').trim());
    return (found as RuntimeIntentKind | undefined) ?? RuntimeIntentKind.UNKNOWN;
  }
}
