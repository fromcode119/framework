/**
 * React ESM Bridge
 * Shares the framework's React instance with plugins.
 */
export default window.React;

export const { 
  useState, 
  useEffect, 
  useMemo, 
  useCallback, 
  useContext, 
  createContext, 
  useRef, 
  useLayoutEffect, 
  useImperativeHandle, 
  useDebugValue, 
  forwardRef, 
  version 
} = window.React;
