import htm from 'htm';
import { createElement } from 'react';

/**
 * `html` — write markup as HTML in a tagged template instead of JSX. Powered by htm, bound to
 * `React.createElement`: no JSX, no `.tsx`, no build transform. Markup reads as HTML with `${…}`
 * interpolation; logic stays in the class. This is the only place raw React markup is produced.
 *
 *   render() {
 *     return html`
 *       <video src=${this.url} controls=${this.playing}></video>
 *       <button onClick=${this.play}>Play</button>
 *     `;
 *   }
 *
 * A tagged-template tag must be a function by JS spec (like a decorator), so it is exported as a
 * bound value rather than a class — the one allowed non-class export, and it lives inside reactor.
 */
export const html = htm.bind(createElement);
