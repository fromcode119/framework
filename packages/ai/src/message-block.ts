import { MessageBlockKind } from '@ai/enums/message-block-kind.enum';

/**
 * One chunk of an assistant message: either prose or a fenced code block.
 *
 * A CLASS, not a discriminated `type` union — the union carried no behaviour, so every consumer
 * re-derived the same question by comparing `block.type` against the raw string `'code'`. The kind is
 * now an `Enum` and the question is a getter, so there is no raw-string comparison to get wrong.
 */
export class MessageBlock {
  private constructor(
    readonly kind: MessageBlockKind,
    readonly content: string,
    readonly language: string = '',
  ) {}

  static text(content: string): MessageBlock {
    return new MessageBlock(MessageBlockKind.TEXT, content);
  }

  static code(content: string, language: string): MessageBlock {
    return new MessageBlock(MessageBlockKind.CODE, content, language);
  }

  get isCode(): boolean {
    return this.kind === MessageBlockKind.CODE;
  }

  /** Language label for display; falls back to a generic one so the header is never blank. */
  get languageLabel(): string {
    return this.language || 'code';
  }
}
