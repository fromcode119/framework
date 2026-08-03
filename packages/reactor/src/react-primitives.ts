import { Children, Fragment, Suspense, createElement, forwardRef, isValidElement, lazy, memo } from 'react';

/**
 * The React values that have no OOP form, surfaced from ONE place.
 *
 * `Fragment`, `Suspense` and `lazy` are React's own components; `createElement`, `Children`,
 * `isValidElement`, `memo` and `forwardRef` are its escape hatches. None of them can be a class of ours —
 * they are React's API — but consumers reaching for them directly is what produces the
 * "non-type import from 'react'" and "raw React escape hatch" findings across plugins and themes.
 *
 * Confining them here is reactor's entire purpose: the ugly parts of React live in this package and
 * nowhere else, so a plugin writes `ReactPrimitives.Fragment` and never imports react itself.
 *
 *   <ReactPrimitives.Fragment key={id}>…</ReactPrimitives.Fragment>
 *   ReactPrimitives.lazy(() => import('./panel'))
 *
 * Prefer a real reactor class where one exists — `PureReactor` instead of `memo`, `this.ref()` instead of
 * `forwardRef`, JSX instead of `createElement`. These are for the cases with no such equivalent.
 */
export class ReactPrimitives {
  static readonly Fragment = Fragment;
  static readonly Suspense = Suspense;
  static readonly lazy = lazy;
  static readonly createElement = createElement;
  static readonly Children = Children;
  static readonly isValidElement = isValidElement;
  static readonly memo = memo;
  static readonly forwardRef = forwardRef;
}
