import { useEffect } from 'react';
import { useSolarStore } from '../store/useSolarStore';
import { api } from '../services/api';
import { NORAD_SATELLITES } from '../data/noradSatellites';
import { getSatelliteGeocentricPosition } from '../components/Satellite';
import { kesslerSyncChannel } from '../services/syncChannel';
import { API_BASE_URL } from '../services/apiConfig';

let currentRequestId = 0;

export function useBackendSync() {
  const setBackendSatellites = useSolarStore((s) => s.setBackendSatellites);
  const setConjunctionAlerts = useSolarStore((s) => s.setConjunctionAlerts);
  const setAuditLogs = useSolarStore((s) => s.setAuditLogs);

  useEffect(() => {
    // Initial fetch of active satellites registered in backend SQLite DB with request sequencing
    const syncBackendSatellites = async () => {
      const requestId = ++currentRequestId;
      let response: Response | null = null;
      try {
        response = await fetch(`${API_BASE_URL}/api/satellites`, {
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) {
          response = await fetch(`${API_BASE_URL}/api/v1/satellites`, {
            headers: { Accept: 'application/json' },
          });
        }
      } catch (err) {}

      // Discard if a newer request or mutation has since updated state
      if (requestId !== currentRequestId) {
        console.log(`[useBackendSync] Discarding stale satellite poll response (req ${requestId} vs current ${currentRequestId})`);
        return;
      }

      if (response && response.ok) {
        try {
          const json = await response.json();
          if (requestId !== currentRequestId) return;
          console.log('[useBackendSync] Raw API response:', json);

          // Properly extract the array whether it's wrapped in .data or returned flat
          const satellitesArray = Array.isArray(json)
            ? json
            : (json.data && Array.isArray(json.data) ? json.data : (json.satellites || []));

          if (satellitesArray.length > 0) {
            setBackendSatellites(satellitesArray);
            console.log('[useBackendSync] Successfully updated store with fleet size:', satellitesArray.length);
            return;
          }
        } catch (jsonErr: any) {
          console.warn('[useBackendSync] Response JSON parse note:', jsonErr.message);
        }
      }

      // Fallback via api service
      const sats = await api.fetchSatellites();
      if (requestId !== currentRequestId) return;
      console.log('=== SYNC DIAGNOSTIC ===');
      console.log('1. Incoming API Array Length:', sats ? sats.length : 0);
      console.log('2. Current Store Length:', useSolarStore.getState().backendSatellites.length);
      if (sats && sats.length > 0) {
        setBackendSatellites(sats);
      }
    };

    // Telemetry Ingestion Loop (Streams 3D geocentric coordinates to Node.js backend)
    const ingestTelemetryStream = async () => {
      for (let i = 0; i < Math.min(5, NORAD_SATELLITES.length); i++) {
        const sat = NORAD_SATELLITES[i];
        const posVec = getSatelliteGeocentricPosition(sat);

        await api.ingestTelemetry({
          satId: sat.name,
          timestamp: Date.now(),
          pos: { x: parseFloat(posVec.x.toFixed(3)), y: parseFloat(posVec.y.toFixed(3)), z: parseFloat(posVec.z.toFixed(3)) },
          vel: { vx: 7.68, vy: 0.12, vz: -0.45 },
        });
      }
    };

    // AI Risk & Audit Log Polling Loop
    const pollBackendAlertsAndLogs = async () => {
      const alerts = await api.fetchConjunctionAlerts();
      setConjunctionAlerts(alerts);

      if (alerts && alerts.length > 0) {
        const storeLogs = useSolarStore.getState().auditLogs;
        alerts.forEach((alert) => {
          const sat1 = alert.sat1Name ?? alert.satA ?? alert.primary_sat_id ?? 'SAT-A';
          const sat2 = alert.sat2Name ?? alert.satB ?? alert.secondary_sat_id ?? 'SAT-B';
          const prob = alert.collisionProb ? (alert.collisionProb * 100).toFixed(1) : '98.5';
          const dist = (alert.missDistanceKm ?? (alert as any).distance ?? 0).toFixed(1);
          const entryMarker = `Critical proximity detected between ${sat1} and ${sat2}`;
          
          if (!storeLogs.some((log) => log.includes(entryMarker))) {
            useSolarStore.getState().addAuditLog(
              `🚨 AI CONJUNCTION ALERT: Critical proximity detected between ${sat1} and ${sat2}. Risk Probability: ${prob}%, Miss Distance: ${dist} KM.`
            );
          }
        });
      }

      const logs = await api.fetchAuditLogs();
      if (logs && logs.length > 0) {
        setAuditLogs(logs);
      }
    };

    const handleBroadcastMessage = (event: MessageEvent) => {
      if (event.data?.type === 'REFRESH_SATELLITES') {
        console.log('[BroadcastChannel] Received cross-tab sync signal. Refreshing fleet and audit logs...');
        useSolarStore.getState().clearDestroyed();
        syncBackendSatellites();
        pollBackendAlertsAndLogs();
      } else if (event.data?.type === 'TX_STARTED') {
        console.log('[BroadcastChannel] Web3 transaction started in peer tab. Locking UI...');
        useSolarStore.getState().setIsGlobalTxPending(true);
      } else if (event.data?.type === 'TX_FINISHED') {
        console.log('[BroadcastChannel] Web3 transaction completed in peer tab. Unlocking UI...');
        useSolarStore.getState().setIsGlobalTxPending(false);
      }
    };

    if (kesslerSyncChannel) {
      kesslerSyncChannel.addEventListener('message', handleBroadcastMessage);
    }

    syncBackendSatellites();
    ingestTelemetryStream();
    pollBackendAlertsAndLogs();

    const telemetryInterval = setInterval(ingestTelemetryStream, 12000);
    const alertInterval = setInterval(pollBackendAlertsAndLogs, 3000); // 3-second polling as specified in Phase 3
    const satInterval = setInterval(syncBackendSatellites, 2500); // 2.5-second polling for responsive backend sync

    return () => {
      if (kesslerSyncChannel) {
        kesslerSyncChannel.removeEventListener('message', handleBroadcastMessage);
      }
      clearInterval(telemetryInterval);
      clearInterval(alertInterval);
      clearInterval(satInterval);
    };
  }, [setBackendSatellites, setConjunctionAlerts, setAuditLogs]);
}
