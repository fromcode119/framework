import { Enum } from '@fromcode119/react-class-components';

/**
 * Where in its section card a part of the record is drawn: the person it is for heads the card, the
 * other records follow the card's own values, and what can be started from them sits in the card's
 * title row (a card only parts fill) or in its ⋯ menu.
 */
export class RecordPartPlace extends Enum {
  static readonly LEAD = new RecordPartPlace('lead');
  static readonly BODY = new RecordPartPlace('body');
  static readonly HEAD = new RecordPartPlace('head');
  static readonly MENU = new RecordPartPlace('menu');

  private constructor(value: string) {
    super(value);
  }
}
