const rd = window.ReactDOM || window.ReactDom; 
export default rd; 
export const render = (...args) => rd.render(...args); 
export const hydrate = (...args) => rd.hydrate(...args); 
export const createPortal = (...args) => rd.createPortal(...args); 
export const createRoot = (...args) => rd.createRoot(...args);
