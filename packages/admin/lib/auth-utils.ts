import Cookies from 'js-cookie';

/**
 * Aggressively purges all authentication cookies across the current host
 * and all possible parent domain variations to resolve session conflicts.
 */
export const purgeAuth = () => {
  if (typeof document === 'undefined') return;
  
  const cookiesToClear = ['fc_token', 'fc_user', 'fc_csrf', 'fc_token_v1', 'fc_token_v2'];
  const hostname = window.location.hostname;
  const domains = [
    hostname,
    '.' + hostname
  ];

  // If we are on a subdomain (e.g. admin.framework.local), 
  // calculate the apex domain (framework.local) and its variations.
  if (hostname.includes('.') && !hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
    const parts = hostname.split('.');
    if (parts.length >= 2) {
      const root = parts.slice(-2).join('.');
      domains.push(root);
      domains.push('.' + root);
    }
  }

  cookiesToClear.forEach(name => {
    // 1. Clear via js-cookie (handles most cases)
    Cookies.remove(name, { path: '/' });
    domains.forEach(d => {
      Cookies.remove(name, { path: '/', domain: d });
    });

    // 2. Clear via raw document.cookie (last resort/insurance)
    // We set the date to 1970 to force expiration
    const expiry = 'expires=Thu, 01 Jan 1970 00:00:00 UTC';
    document.cookie = `${name}=; path=/; ${expiry}`;
    domains.forEach(d => {
      document.cookie = `${name}=; path=/; domain=${d}; ${expiry}`;
    });
  });

  console.log(`[AuthUtils] Purged cookies for domains: ${domains.join(', ')}`);
};

/**
 * Calculates current domain scope for cookie setting.
 */
export const getCookieDomain = () => {
  if (typeof window === 'undefined') return undefined;
  const hostname = window.location.hostname;
  
  if (hostname.includes('.') && !hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
    const parts = hostname.split('.');
    if (parts.length >= 2) {
      return '.' + parts.slice(-2).join('.');
    }
  }
  return undefined;
};
