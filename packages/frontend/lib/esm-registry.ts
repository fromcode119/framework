
/**
 * ESM Registry Utility
 * Generates the import map configuration for the framework runtime.
 */

export const generateImportMap = () => {
  return {
    imports: {
      "react": "/framework/runtime/react",
      "react-dom": "/framework/runtime/react-dom",
      "@fromcode/react": "/framework/runtime/fromcode-react",
      "react/jsx-runtime": "/framework/runtime/react-jsx",
      "lucide-react": "/framework/runtime/lucide-react"
    }
  };
};
