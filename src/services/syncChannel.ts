// Global Web BroadcastChannel for Instant 0ms Cross-Tab Synchronization
export const kesslerSyncChannel =
  typeof window !== 'undefined' && 'BroadcastChannel' in window
    ? new BroadcastChannel('kessler_grid_sync')
    : null;

export const broadcastSatelliteRefresh = () => {
  try {
    if (kesslerSyncChannel) {
      kesslerSyncChannel.postMessage({ type: 'REFRESH_SATELLITES', timestamp: Date.now() });
    }
  } catch (err) {
    console.warn('[BroadcastChannel] Post message notice:', err);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('kessler:refresh-satellites', { detail: { timestamp: Date.now() } }));
  }
};

export const broadcastTxStarted = () => {
  try {
    if (kesslerSyncChannel) {
      kesslerSyncChannel.postMessage({ type: 'TX_STARTED', timestamp: Date.now() });
    }
  } catch (err) {
    console.warn('[BroadcastChannel] TX started notice:', err);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('kessler:tx-started', { detail: { timestamp: Date.now() } }));
  }
};

export const broadcastTxFinished = () => {
  try {
    if (kesslerSyncChannel) {
      kesslerSyncChannel.postMessage({ type: 'TX_FINISHED', timestamp: Date.now() });
    }
  } catch (err) {
    console.warn('[BroadcastChannel] TX finished notice:', err);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('kessler:tx-finished', { detail: { timestamp: Date.now() } }));
  }
};

export const broadcastSceneReset = () => {
  try {
    if (kesslerSyncChannel) {
      kesslerSyncChannel.postMessage({ type: 'RESET_SCENE', timestamp: Date.now() });
    }
  } catch (err) {
    console.warn('[BroadcastChannel] Scene reset notice:', err);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('kessler:reset-scene', { detail: { timestamp: Date.now() } }));
  }
};


