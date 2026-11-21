import { Platform } from '@fromcode119/react-class-components';
import type { ILabelSheetLayout } from '@/components/ui/interfaces/label-sheet-layout.interface';

/**
 * Prints labels — product stickers, box labels, shelf tags — on A4 the way label paper is laid out.
 *
 * The caller gives each label's inner markup (escape what it did not write with `LabelSheet.escape`,
 * put a code in with `QrCode.svg`) and a layout; `print` lays them out page by page, opens the
 * browser's print dialog and removes the page afterwards. `html` gives the same document without
 * printing it, for a preview.
 */
export class LabelSheet {
  /** Common A4 label papers. */
  static readonly LAYOUTS: Record<'a4x24' | 'a4x10' | 'a4x1', ILabelSheetLayout> = {
    a4x24: { columns: 3, rows: 8, widthMm: 70, heightMm: 37.125 },
    a4x10: { columns: 2, rows: 5, widthMm: 105, heightMm: 57, topMm: 6 },
    a4x1: { columns: 1, rows: 1, widthMm: 194, heightMm: 281, topMm: 8, cutLines: false },
  };

  static escape(value: unknown): string {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
  }

  /** The printable document: every label in order, as many pages as they need. */
  static html(labels: string[], layout: ILabelSheetLayout, title = '', css = ''): string {
    const perPage = Math.max(1, layout.columns * layout.rows);
    const pages: string[][] = [];
    for (let i = 0; i < labels.length; i += perPage) pages.push(labels.slice(i, i + perPage));
    const cut = layout.cutLines === false ? 'none' : '0.2mm dashed #bbb';
    return `<!doctype html><html><head><meta charset="utf-8"><title>${LabelSheet.escape(title)}</title><style>
@page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#000;background:#fff}
.page{width:210mm;height:297mm;padding-top:${layout.topMm ?? 0}mm;display:grid;grid-template-columns:repeat(${layout.columns},${layout.widthMm}mm);grid-auto-rows:${layout.heightMm}mm;justify-content:center;align-content:start;overflow:hidden;break-after:page}
.page:last-child{break-after:auto}
.label{overflow:hidden;outline:${cut};outline-offset:-0.1mm;padding:2mm 3mm}
.label svg{display:block}
${css}
</style></head><body>${pages.map((page) => `<section class="page">${page.map((label) => `<div class="label">${label}</div>`).join('')}</section>`).join('')}</body></html>`;
  }

  /** Opens the print dialog for the labels. Does nothing outside a browser or with no labels. */
  static print(labels: string[], layout: ILabelSheetLayout, title = '', css = ''): void {
    if (!Platform.isBrowser || !labels.length) return;
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0';
    document.body.appendChild(frame);
    const doc = frame.contentDocument as Document;
    doc.open();
    doc.write(LabelSheet.html(labels, layout, title, css));
    doc.close();
    const win = frame.contentWindow as Window;
    win.addEventListener('afterprint', () => frame.remove(), { once: true });
    // Let the SVGs lay out before the dialog takes its snapshot of the page.
    setTimeout(() => { win.focus(); win.print(); }, 150);
  }
}
