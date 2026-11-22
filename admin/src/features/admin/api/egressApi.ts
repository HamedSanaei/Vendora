import { httpClient } from '../../../lib/api/httpClient';

export type ProxyScheme = 'http' | 'https' | 'socks5';
export interface EgressCheck { at: string; path: 'Proxy' | 'Direct'; code: string; milliseconds: number }
export interface ProfileDraft {
  id?: string; version?: string; name: string; scheme: ProxyScheme; host: string; port: number;
  timeoutSeconds: number; enabled: boolean; note: string; user: string; password: string; clearCredential: boolean;
}
export type EgressProfile = Omit<ProfileDraft, 'id' | 'version' | 'user' | 'password' | 'clearCredential'> &
  { id: string; version: string; hasCredential: boolean; lastTest?: EgressCheck | null };
export interface EgressRoute { service: string; version: string | null; enabled: boolean; proxyId: string | null; canProxy: boolean; lastTest?: EgressCheck | null }
export interface EgressAudit { id: string; at: string; action: string; target: string; actor?: string | null }
export interface EgressSettings { profiles: EgressProfile[]; routes: EgressRoute[]; audit: EgressAudit[] }

const base = '/api/admin/egress';

/** Reads safe projections and writes credentials only when explicitly supplied. */
export const egressApi = {
  async read() { return (await httpClient.get<EgressSettings>(base)).data; },
  async save(profile: ProfileDraft) { await httpClient.put(`${base}/profiles`, profile); },
  async remove(profile: EgressProfile) {
    await httpClient.delete(`${base}/profiles/${profile.id}`, { params: { version: profile.version } });
  },
  async assign(route: EgressRoute, proxyId: string) {
    await httpClient.put(`${base}/routes/${route.service}`, { version: route.version, enabled: Boolean(proxyId), proxyId: proxyId || null });
  },
  async test(target: { proxyId: string } | { service: string }) {
    await httpClient.post<EgressCheck>(`${base}/test`, target, { timeout: 65000 });
  },
};
