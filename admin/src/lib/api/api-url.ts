/** Resolves relative production API roots against the current host, retaining explicit API origins for separate dev deployments. */
export function resolveAdminApiBaseUrl(configured: string | undefined, origin: string, development: boolean): string {
  return new URL(configured?.trim() || (development ? 'http://localhost:5020' : '/'), origin).href.replace(/\/$/, '');
}
