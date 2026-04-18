const createRuntimeElement = (type, props, key) =>
  window.React.createElement(type, key === undefined ? props : { ...(props || {}), key });

export const jsx = createRuntimeElement;
export const jsxs = createRuntimeElement;
export const jsxDEV = createRuntimeElement;
export const Fragment = window.React.Fragment;

export default { jsx, jsxs, jsxDEV, Fragment };
