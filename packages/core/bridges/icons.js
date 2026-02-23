// Dynamic Icon Bridge
import { createProxyIcon } from '@fromcode119/react';

// Explicitly export known keys for named imports
{{EXPORTS}}

// Default export is a proxy for any other icon name
export default new Proxy({}, { 
    get: (_, name) => createProxyIcon(name) 
});
