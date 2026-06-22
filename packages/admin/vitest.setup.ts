import '@testing-library/jest-dom';

// jsdom does not implement window.matchMedia; provide a no-op polyfill so components that query it
// (ThemeProvider's prefers-color-scheme check, the sidebar's min-width body-scroll lock, etc.)
// can mount under the jsdom test environment instead of throwing "matchMedia is not a function".
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
