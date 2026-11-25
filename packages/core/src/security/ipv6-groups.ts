/** The eight 16-bit groups of an IPv6 address, as numbers. */
export class Ipv6Groups {
  /** The groups of a plain IPv6 address (`::` allowed; no zone, no dotted tail), or null. */
  static parse(address: string): number[] | null {
    const [head, tail, ...rest] = address.split('::');
    if (rest.length || /[.%]/.test(address)) return null;
    const read = (text: string | undefined): number[] => (text ? text.split(':').map((group) => parseInt(group, 16)) : []);
    const first = read(head);
    const last = read(tail);
    const fill = 8 - first.length - last.length;
    if (tail === undefined ? fill !== 0 : fill < 1) return null;
    const groups = [...first, ...new Array(Math.max(fill, 0)).fill(0), ...last];
    return groups.length === 8 && groups.every((group) => Number.isInteger(group) && group >= 0 && group <= 0xffff) ? groups : null;
  }
}
