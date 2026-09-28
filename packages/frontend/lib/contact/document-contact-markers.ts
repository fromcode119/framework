/** The attributes the server pass writes and the browser restore reads — named in one place for both. */
export class DocumentContactMarkers {
  /** On a placeholder `<span>` standing in for a contact detail in text: the encoded text. */
  static readonly TEXT = 'data-fc-c';
  /** On an element whose attributes held a contact detail: `name:encodedValue;…` for each attribute taken out. */
  static readonly ATTRIBUTES = 'data-fc-ca';
  static readonly PAIR_SEPARATOR = ';';
  static readonly NAME_SEPARATOR = ':';
}
