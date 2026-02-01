// Dynamic Icon Bridge
import { createProxyIcon } from '@fromcode/react';

// Explicitly export known keys for named imports
export const { {{KEYS}} } = new Proxy({}, { 
    get: (_, name) => window.Fromcode.getIcon(name) 
});

// Default export is a proxy for any other icon name
export default new Proxy({}, { 
    get: (_, name) => createProxyIcon(name) 
});
