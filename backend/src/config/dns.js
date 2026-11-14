/**
 * DNS configuration helper for MongoDB Atlas SRV resolution.
 *
 * NOTE: Calling dns.setServers affects only the dns.resolve* family of methods
 * (which the MongoDB driver uses to resolve mongodb+srv:// SRV and TXT records),
 * NOT dns.lookup (which system HTTP requests use).
 *
 * This setting is strictly opt-in via the DNS_SERVERS environment variable.
 * It is never needed in standard production environments (e.g. Render/Linux)
 * and is intended solely for local development networks whose local resolvers
 * block or fail to answer SRV DNS queries.
 */

import dns from 'node:dns';

/**
 * Applies custom DNS servers for dns.resolve* calls.
 *
 * @param {string[]|undefined|null} servers - Array of IP address strings
 * @param {typeof dns} [dnsModule=dns] - Injected DNS module for testability
 * @returns {boolean} true if custom servers were successfully set, false otherwise
 */
export function applyDnsServers(servers, dnsModule = dns) {
  if (!servers || !Array.isArray(servers) || servers.length === 0) {
    return false;
  }

  try {
    dnsModule.setServers(servers);
    console.log('[DNS] Using custom DNS servers for SRV lookups');
    return true;
  } catch (err) {
    console.warn(`[DNS Warning] Failed to configure custom DNS servers: ${err.message}`);
    return false;
  }
}

