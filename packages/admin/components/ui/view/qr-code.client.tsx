import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import QRCodeEncoder from 'qrcode';
import { AdminClass } from '@/lib/admin-class';

/**
 * A QR code for a value — a link, a SKU, a box number — drawn as one SVG path, black on white with the
 * four-module quiet zone a phone needs to find it. Medium error correction, so a scuffed label on a
 * box still reads. An optional caption under it says what it opens. With no value it renders nothing.
 *
 * `QrCode.svg()` gives the same drawing as markup for a page that is printed rather than shown.
 */
export class QrCode extends PureReactor {
  @prop declare value: string;
  /** Edge length in CSS pixels. */
  @prop declare size?: number;
  /** One short line under the code, e.g. what scanning it opens. */
  @prop declare caption?: ReactNode;
  /** The accessible name; the value itself when not given. */
  @prop declare title?: string;
  @prop declare className?: string;

  private static readonly QUIET = 4;

  /** The modules as one path, and the side of the square they sit in (quiet zone included). */
  static path(value: string): { d: string; side: number } {
    const modules = QRCodeEncoder.create(value, { errorCorrectionLevel: 'M' }).modules;
    const n = modules.size, q = QrCode.QUIET;
    let d = '';
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) if (modules.get(x, y)) d += `M${x + q} ${y + q}h1v1h-1z`;
    }
    return { d, side: n + q * 2 };
  }

  /** The code as SVG markup, `size` being any CSS length (`30mm`, `120px`). */
  static svg(value: string, size = '30mm'): string {
    const { d, side } = QrCode.path(value);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${side} ${side}" width="${size}" height="${size}" shape-rendering="crispEdges"><rect width="${side}" height="${side}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
  }

  render(): ReactNode {
    if (!this.value) return null;
    const { d, side } = QrCode.path(this.value);
    const size = this.size ?? 128;
    const name = AdminClass.of('qr');
    return (
      <figure className={`${name} ${this.className ?? ''}`}>
        <svg role="img" aria-label={this.title ?? this.value} viewBox={`0 0 ${side} ${side}`} width={size} height={size} shapeRendering="crispEdges">
          <rect width={side} height={side} fill="#fff" />
          <path d={d} fill="#000" />
        </svg>
        {this.caption ? <figcaption className={`${name}__caption`}>{this.caption}</figcaption> : null}
      </figure>
    );
  }
}
