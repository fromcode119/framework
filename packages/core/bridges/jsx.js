function createRuntimeElement(type, props, key) {
  return window.React.createElement(type, key === undefined ? props : { ...(props || {}), key });
}

export function jsx(type, props, key) {
  return createRuntimeElement(type, props, key);
}

export function jsxs(type, props, key) {
  return createRuntimeElement(type, props, key);
}

export function jsxDEV(type, props, key) {
  return createRuntimeElement(type, props, key);
}

// JSX-runtime contract requires a named `Fragment` VALUE export (the transform passes it as an element
// type). It is React's Fragment symbol — there is no function/class form, so this must stay a binding.
export const Fragment = window.React.Fragment;

export default { jsx, jsxs, jsxDEV, Fragment };
