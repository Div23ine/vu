import { cookies } from 'next/headers';
import {
  UampIncidentListResponse,
  UampMonitorListResponse,
  type UampIncident,
  type UampMonitor
} from '@vunvault/contracts';
import { env } from '../env';

export interface UampDashboardData {
  monitors: UampMonitor[];
  monitorTotal: number;
  incidents: UampIncident[];
  incidentTotal: number;
}

export async function getUampDashboardData(): Promise<UampDashboardData> {
  const store = await cookies();
  const cookieHeader = store.getAll().map((cookie) => cookie.name + '=' + cookie.value).join('; ');
  if (!cookieHeader) throw new Error('uamp_session_missing');

  const headers = { cookie: cookieHeader, accept: 'application/json' };
  const [monitorResponse, incidentResponse] = await Promise.all([
    fetch(env.NEXT_PUBLIC_API_URL + '/api/v1/uamp/monitors?page=1&pageSize=100', {
      headers,
      cache: 'no-store'
    }),
    fetch(env.NEXT_PUBLIC_API_URL + '/api/v1/uamp/incidents?page=1&pageSize=100', {
      headers,
      cache: 'no-store'
    })
  ]);

  if (!monitorResponse.ok || !incidentResponse.ok) {
    if (monitorResponse.status === 403 || incidentResponse.status === 403) {
      throw new Error('uamp_access_denied');
    }
    throw new Error('uamp_api_unavailable');
  }

  const [monitorBody, incidentBody]: [unknown, unknown] = await Promise.all([
    monitorResponse.json(),
    incidentResponse.json()
  ]);
  const monitors = UampMonitorListResponse.safeParse(monitorBody);
  const incidents = UampIncidentListResponse.safeParse(incidentBody);
  if (!monitors.success || !incidents.success) throw new Error('uamp_api_contract_mismatch');

  return {
    monitors: monitors.data.data,
    monitorTotal: monitors.data.total,
    incidents: incidents.data.data,
    incidentTotal: incidents.data.total
  };
}
