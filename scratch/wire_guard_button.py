import re

with open('src/components/HUDOverlay.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Add web3Service import if not present
if "import { web3Service }" not in code:
    code = code.replace("import { Web3StakingModal } from './Web3StakingModal';", "import { Web3StakingModal } from './Web3StakingModal';\nimport { web3Service } from '../services/web3';")

# Add pendingBurnId & burnToastMsg states in HUDOverlay component
state_insertion = """  const [pendingBurnId, setPendingBurnId] = useState<string | number | null>(null);
  const [burnToastMsg, setBurnToastMsg] = useState<string | null>(null);

  const handleExecuteAvoidanceBurn = async (alert: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const satId = alert.sat1Id || alert.satA || alert.primary_sat_id || '25544';
    const alertId = alert.id || satId;

    setPendingBurnId(alertId);
    setBurnToastMsg(`⏳ Connecting MetaMask for on-chain avoidance burn (${satId})...`);

    try {
      if (!isWeb3Connected) {
        await web3Service.connectWallet();
      }

      await web3Service.ensureHardhatNetwork();
      const txHash = await web3Service.executeAvoidanceBurnOnChain(satId);

      setBurnToastMsg(`🎉 On-chain avoidance burn confirmed! Tx: ${txHash.slice(0, 14)}...`);

      // Filter resolved alert out of Zustand store
      const currentAlerts = useSolarStore.getState().conjunctionAlerts;
      const updatedAlerts = currentAlerts.filter((a: any) => (a.id || a.sat1Id) !== alertId);
      useSolarStore.getState().setConjunctionAlerts(updatedAlerts);

      setTimeout(() => setBurnToastMsg(null), 5000);
    } catch (err: any) {
      console.error('Avoidance Burn Error:', err);
      const msg = err.reason || err.message || 'Transaction rejected';
      setBurnToastMsg(`⛔ Avoidance burn failed: ${msg}`);
      setTimeout(() => setBurnToastMsg(null), 6000);
    } finally {
      setPendingBurnId(null);
    }
  };"""

code = code.replace("export function HUDOverlay() {", "import { useState } from 'react';\nexport function HUDOverlay() {" if "useState" not in code else "export function HUDOverlay() {")
code = code.replace("  const currentPlanet = SOLAR_SYSTEM.find((p) => p.id === focusedBody);", state_insertion + "\n\n  const currentPlanet = SOLAR_SYSTEM.find((p) => p.id === focusedBody);")

# Replace static status badge with Web3 GUARD button
old_badge = """                  {/* Right Status Badge */}
                  <div
                    style={{
                      fontSize: '8.5px',
                      fontWeight: 700,
                      color: alert.slashingTriggered ? '#10b981' : '#f59e0b',
                      background: alert.slashingTriggered
                        ? 'rgba(16, 185, 129, 0.2)'
                        : 'rgba(245, 158, 11, 0.2)',
                      border: `1px solid ${alert.slashingTriggered ? '#10b981' : '#f59e0b'}`,
                      borderRadius: '4px',
                      padding: '2px 6px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {alert.slashingTriggered ? 'PROTECTED' : 'GUARD'}
                  </div>"""

new_button = """                  {/* Right Web3 Action Button */}
                  <button
                    onClick={(e) => handleExecuteAvoidanceBurn(alert, e)}
                    disabled={pendingBurnId === (alert.id || alert.sat1Id)}
                    style={{
                      fontSize: '8.5px',
                      fontWeight: 700,
                      color: alert.slashingTriggered ? '#10b981' : '#ffffff',
                      background: pendingBurnId === (alert.id || alert.sat1Id)
                        ? 'rgba(56, 189, 248, 0.4)'
                        : alert.slashingTriggered
                        ? 'rgba(16, 185, 129, 0.2)'
                        : 'rgba(239, 68, 68, 0.75)',
                      border: `1px solid ${
                        pendingBurnId === (alert.id || alert.sat1Id)
                          ? '#38bdf8'
                          : alert.slashingTriggered
                          ? '#10b981'
                          : '#ef4444'
                      }`,
                      borderRadius: '4px',
                      padding: '4px 8px',
                      whiteSpace: 'nowrap',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: '0 0 10px rgba(239, 68, 68, 0.3)',
                    }}
                  >
                    {pendingBurnId === (alert.id || alert.sat1Id)
                      ? 'EXECUTING BURN...'
                      : alert.slashingTriggered
                      ? 'PROTECTED'
                      : '🔥 BURN / GUARD'}
                  </button>"""

if old_badge in code:
    code = code.replace(old_badge, new_button)
    print("Successfully replaced static GUARD badge with Web3 executeAvoidanceBurnOnChain button!")
else:
    print("Failed to match old_badge precisely.")

# Insert burnToastMsg notification bar at top center of HUDOverlay if burnToastMsg exists
toast_ui = """      {/* Web3 Avoidance Burn Feedback Banner */}
      {burnToastMsg && (
        <div
          style={{
            position: 'absolute',
            top: '76px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(15, 23, 42, 0.95)',
            border: '1px solid #38bdf8',
            borderRadius: '8px',
            padding: '10px 18px',
            color: '#38bdf8',
            fontFamily: 'monospace',
            fontSize: '11.5px',
            fontWeight: 700,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.8), 0 0 15px rgba(56, 189, 248, 0.3)',
            zIndex: 9999,
            pointerEvents: 'auto',
          }}
        >
          {burnToastMsg}
        </div>
      )}"""

code = code.replace("<NASATimeController />", toast_ui + "\n\n      <NASATimeController />")

with open('src/components/HUDOverlay.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("Updated HUDOverlay.tsx with Web3 Avoidance Burn handler and feedback toast!")
