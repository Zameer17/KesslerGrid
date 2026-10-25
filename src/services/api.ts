import axios from 'axios';
import { API_BASE_URL as HOST_URL } from './apiConfig';

const API_BASE_URL = `${HOST_URL}/api`;

export interface BackendSatellite {
  sat_id: string;
  operator_address: string;
  norad_cat_id: number;
  satellite_name: string;
  staked_amount_eth: number;
  liability_bond_eth?: number;
  liability_penalty_eth?: number;
  operational_status: string;
  registered_at?: string;
  isRegistered?: boolean;
  is_registered?: boolean;
  on_chain_status?: string;
  staked_eth?: number;
}

export interface ConjunctionAlert {
  id?: number;
  sat1Id?: string;
  sat1Name?: string;
  sat2Id?: string;
  sat2Name?: string;
  satA?: string;
  satB?: string;
  primary_sat_id?: string;
  secondary_sat_id?: string;
  missDistanceKm?: number;
  collisionProb?: number;
  riskScore?: number;
  threatLevel?: string;
  tcaTimestamp?: string;
  slashingTriggered?: boolean | number;
  slashing_triggered?: boolean | number;
}

export interface TelemetryPayload {
  satId: string;
  timestamp?: number;
  pos: { x: number; y: number; z: number };
  vel: { vx: number; vy: number; vz: number };
}

export const api = {
  // Safe fetch for catalog satellites from backend SQLite database
  async fetchOrbitalSatellites(): Promise<BackendSatellite[]> {
    try {
      const res = await axios.get('/api/satellites', {
        headers: { Accept: 'application/json' },
        params: { _t: Date.now() },
      });
      const data = res.data;
      const list = Array.isArray(data) ? data : (data?.data || data?.satellites || []);
      if (Array.isArray(list)) return list;
    } catch {}

    try {
      const res = await axios.get(`${API_BASE_URL}/satellites`, {
        params: { _t: Date.now() },
      });
      const data = res.data;
      const list = Array.isArray(data) ? data : (data?.data || data?.satellites || []);
      if (Array.isArray(list)) return list;
    } catch {}

    try {
      const fallbackRes = await axios.get('/api/v1/satellites', {
        params: { _t: Date.now() },
      });
      const data = fallbackRes.data;
      const list = Array.isArray(data) ? data : (data?.data || data?.satellites || []);
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  },

  // Alias for backward compatibility
  async fetchSatellites(): Promise<BackendSatellite[]> {
    return this.fetchOrbitalSatellites();
  },

  async registerSatellite(payload: {
    satId: string;
    noradId: number;
    satelliteName: string;
    operatorAddress: string;
    stakedEth?: number;
    liabilityPenaltyEth?: number;
  }) {
    try {
      const res = await axios.post(`${API_BASE_URL}/v1/satellites/register`, payload);
      return res.data;
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  // Telemetry Stream Ingestion
  async ingestTelemetry(payload: TelemetryPayload) {
    try {
      const res = await axios.post(`${API_BASE_URL}/v1/telemetry/ingest`, payload);
      return res.data;
    } catch (err) {
      return null;
    }
  },

  // Safe fetch for AI Conjunction Risk Alerts (try/catch + non-array/HTML guardrail)
  async fetchConjunctionAlerts(): Promise<ConjunctionAlert[]> {
    try {
      const res = await axios.get(`${API_BASE_URL}/conjunctions`, {
        headers: { Accept: 'application/json' },
        validateStatus: (status) => status === 200,
      });

      if (!res.data || typeof res.data === 'string') return [];
      const list = Array.isArray(res.data) ? res.data : res.data?.data;
      return Array.isArray(list) ? list : [];
    } catch (err) {
      return [];
    }
  },

  // Oracle Audit Logs
  async fetchAuditLogs(): Promise<string[]> {
    try {
      const res = await axios.get(`${API_BASE_URL}/v1/oracle/audit-logs`);
      if (Array.isArray(res.data?.logs) && res.data.logs.length > 0) return res.data.logs;
      if (Array.isArray(res.data?.entries) && res.data.entries.length > 0) {
        return res.data.entries.map((r: any) => 
          typeof r === 'string' ? r : `[${r.timestamp}] [${r.event_type || 'SYSTEM'}] ${r.primary_asset || ''} <-> ${r.threat_asset || ''} | ${r.financial_transfer || ''} | Status: ${r.state_change || ''}`
        );
      }
      if (Array.isArray(res.data) && res.data.length > 0) {
        return res.data.map((r: any) => 
          typeof r === 'string' ? r : `[${r.timestamp}] [${r.event_type || 'SYSTEM'}] ${r.primary_asset || ''} <-> ${r.threat_asset || ''} | ${r.financial_transfer || ''} | Status: ${r.state_change || ''}`
        );
      }
    } catch {}

    try {
      const res2 = await axios.get(`${API_BASE_URL}/audit-logs`);
      if (Array.isArray(res2.data)) {
        return res2.data.map((r: any) => 
          typeof r === 'string' ? r : `[${r.timestamp}] [${r.event_type || 'SYSTEM'}] ${r.primary_asset || ''} <-> ${r.threat_asset || ''} | ${r.financial_transfer || ''} | Status: ${r.state_change || ''}`
        );
      }
      return [];
    } catch (err) {
      return [];
    }
  },

  async clearAuditLogs() {
    try {
      const res = await axios.delete(`${API_BASE_URL}/v1/oracle/audit-logs`);
      return res.data;
    } catch (err) {
      return null;
    }
  },

  // Admin Reset Database Endpoint
  async resetDatabase() {
    return resetDemoDatabase();
  },

  // Collision & Liability Trigger Methods
  async triggerCollision(payload: { primary_sat_id?: string; secondary_sat_id?: string; [key: string]: any }) {
    try {
      const res = await axios.post(`${API_BASE_URL}/api/demo/trigger-collision`, payload);
      return res.data;
    } catch {
      try {
        const res = await axios.post('/api/demo/trigger-collision', payload);
        return res.data;
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }
  },

  async assessLiability(payload: { primary_sat_id?: string; secondary_sat_id?: string; [key: string]: any }) {
    try {
      const res = await axios.post(`${API_BASE_URL}/api/collision/assess-liability`, payload);
      return res.data;
    } catch {
      try {
        const res = await axios.post('/api/collision/assess-liability', payload);
        return res.data;
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }
  },

  async reportImpact(payload: any) {
    try {
      const res = await axios.post(`${API_BASE_URL}/api/collision/impact`, payload);
      return res.data;
    } catch {
      try {
        const res = await axios.post('/api/collision/impact', payload);
        return res.data;
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }
  },

  resetDemoDatabase,
  restoreFleet,
};

export async function resetDemoDatabase() {
  try {
    const res = await axios.post(`${API_BASE_URL}/reset`);
    return res.data;
  } catch (err: any) {
    const res = await fetch(`${API_BASE_URL}/reset`, { method: 'POST' });
    return await res.json();
  }
}

export async function restoreFleet() {
  try {
    const res = await axios.post(`${API_BASE_URL}/restore-fleet`);
    return res.data;
  } catch (err: any) {
    const res = await fetch(`${API_BASE_URL}/restore-fleet`, { method: 'POST' });
    return await res.json();
  }
}

