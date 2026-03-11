// Dynamic Icon Bridge
import { FrameworkIcons } from '@fromcode119/react';

// Explicitly export known keys for named imports
{{EXPORTS}}

// Default export is a proxy for any other icon name
export default new Proxy({}, { 
    get: (_, name) => FrameworkIcons.createProxyIcon(name) 
});
