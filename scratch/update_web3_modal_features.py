import re

with open('src/components/Web3StakingModal.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Update imports
if "clearAuditLogs" not in code:
    code = code.replace("const auditLogs = useSolarStore((s) => s.auditLogs);", "const auditLogs = useSolarStore((s) => s.auditLogs);\n  const clearAuditLogs = useSolarStore((s) => s.clearAuditLogs);\n  const addAuditLog = useSolarStore((s) => s.addAuditLog);")

# 2. Add handleResetDatabase function
reset_handler = """  const handleResetDatabase = async () => {
    setIsSubmitting(true);
    setStatusMessage('⏳ Resetting backend SQLite database for live demo...');
    try {
      const res = await api.resetDatabase();
      const sats = await api.fetchSatellites();
      useSolarStore.getState().setBackendSatellites(sats);
      addAuditLog('🗑️ DEMO RESET: Database conjunction events cleared and state re-seeded.');
      setStatusMessage('🎉 Database reset successfully! Conjunction events cleared for live demo.');
    } catch (err: any) {
      setStatusMessage(`⚠️ Reset error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };"""

code = code.replace("const handleClaimFaucet = async () => {", reset_handler + "\n\n  const handleClaimFaucet = async () => {")

# 3. Add audit logs when registering satellite
reg_audit_entry = """      addAuditLog(`🛰️ REGISTRATION: Satellite ${regName} (NORAD #${regNoradId}) successfully registered with ${regStakeEth} ETH initial collateral.`);
      setStatusMessage(`✅ Satellite ${regSatId} processed in SQLite DB & On-Chain! ${txHash ? '(Tx: ' + txHash.slice(0, 14) + '...)' : ''}`);"""

code = code.replace("setStatusMessage(`✅ Satellite ${regSatId} processed in SQLite DB & On-Chain! ${txHash ? '(Tx: ' + txHash.slice(0, 14) + '...)' : ''}`);", reg_audit_entry)

# 4. Add audit logs when executing stake
stake_audit_entry = """      addAuditLog(`💰 STAKE UPDATE: Added ${stakeAmountEth} ETH collateral to Satellite ${selectedSatId}.`);
      setStatusMessage(`🎉 On-chain stake confirmed! Tx Hash: ${txHash.slice(0, 14)}...`);"""

code = code.replace("setStatusMessage(`🎉 On-chain stake confirmed! Tx Hash: ${txHash.slice(0, 14)}...`);", stake_audit_entry)

# 5. Add "CLEAR / RESET DATABASE" button in Modal Header
header_buttons = """            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleResetDatabase}
                disabled={isSubmitting}
                title="Reset SQLite Database & Conjunction Events for Demo"
                style={{
                  background: 'rgba(239, 68, 68, 0.2)',
                  border: '1px solid #ef4444',
                  borderRadius: '8px',
                  padding: '4px 10px',
                  color: '#f87171',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                🗑️ RESET DB
              </button>
              <button
                onClick={handleClose}"""

code = code.replace("<button\n              onClick={handleClose}", header_buttons)

# 6. Separate Registered vs Unregistered Satellites & Filter Staking Dropdown
old_staking_select = """                <select
                  value={selectedSatId}
                  onChange={(e) => setSelectedSatId(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#0f172a',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '8px',
                    padding: '10px',
                    color: '#ffffff',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                >
                  {NORAD_SATELLITES.map((sat) => {
                    const isReg = backendSatellites.some(
                      (b) => b.sat_id === sat.name || b.satellite_name === sat.name
                    );
                    return (
                      <option key={sat.id} value={sat.name}>
                        {isReg ? '🟢 [REGISTERED]' : '🔴 [UNREGISTERED]'} {sat.name} (NORAD #{sat.noradId})
                      </option>
                    );
                  })}
                </select>"""

new_staking_select = """                <select
                  value={selectedSatId}
                  onChange={(e) => setSelectedSatId(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#0f172a',
                    border: '1px solid #10b981',
                    borderRadius: '8px',
                    padding: '10px',
                    color: '#ffffff',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                >
                  {NORAD_SATELLITES.filter((sat) =>
                    backendSatellites.some((b) => b.sat_id === sat.name || b.satellite_name === sat.name)
                  ).length === 0 ? (
                    <option value="" disabled>-- No Registered Satellites Available for Staking --</option>
                  ) : (
                    NORAD_SATELLITES.filter((sat) =>
                      backendSatellites.some((b) => b.sat_id === sat.name || b.satellite_name === sat.name)
                    ).map((sat) => (
                      <option key={sat.id} value={sat.name}>
                        🟢 [REGISTERED] {sat.name} (NORAD #{sat.noradId} | {sat.category})
                      </option>
                    ))
                  )}
                </select>"""

code = code.replace(old_staking_select, new_staking_select)

# 7. Update Registration Dropdown to ONLY show UNREGISTERED satellites with Duplicate Guard
old_reg_select = """                <select
                  onChange={(e) => {
                    const selected = NORAD_SATELLITES.find((s) => s.name === e.target.value);
                    if (selected) {
                      setRegSatId(selected.name);
                      setRegNoradId(selected.noradId.toString());
                      setRegName(selected.name);
                    }
                  }}
                  defaultValue=""
                  style={{
                    width: '100%',
                    background: '#0f172a',
                    border: '1px solid #38bdf8',
                    borderRadius: '8px',
                    padding: '10px',
                    color: '#ffffff',
                    fontSize: '13px',
                    outline: 'none',
                    marginBottom: '8px',
                  }}
                >
                  <option value="" disabled>-- Select a satellite from 3D fleet catalog --</option>
                  {NORAD_SATELLITES.map((sat) => (
                    <option key={sat.id} value={sat.name}>
                      {sat.name} (NORAD #{sat.noradId} | {sat.category})
                    </option>
                  ))}
                </select>"""

new_reg_select = """                <select
                  onChange={(e) => {
                    const selected = NORAD_SATELLITES.find((s) => s.name === e.target.value);
                    if (selected) {
                      const isAlreadyReg = backendSatellites.some(
                        (b) => b.sat_id === selected.name || b.satellite_name === selected.name
                      );
                      if (isAlreadyReg) {
                        setStatusMessage(`⚠️ Satellite ${selected.name} is already registered on-chain.`);
                        return;
                      }
                      setRegSatId(selected.name);
                      setRegNoradId(selected.noradId.toString());
                      setRegName(selected.name);
                      setStatusMessage(null);
                    }
                  }}
                  defaultValue=""
                  style={{
                    width: '100%',
                    background: '#0f172a',
                    border: '1px solid #38bdf8',
                    borderRadius: '8px',
                    padding: '10px',
                    color: '#ffffff',
                    fontSize: '13px',
                    outline: 'none',
                    marginBottom: '8px',
                  }}
                >
                  <option value="" disabled>-- Select an unregistered satellite from catalog --</option>
                  {NORAD_SATELLITES.filter(
                    (sat) => !backendSatellites.some((b) => b.sat_id === sat.name || b.satellite_name === sat.name)
                  ).map((sat) => (
                    <option key={sat.id} value={sat.name}>
                      ⚪ [UNREGISTERED] {sat.name} (NORAD #{sat.noradId} | {sat.category})
                    </option>
                  ))}
                </select>"""

code = code.replace(old_reg_select, new_reg_select)

# 8. Add Clear Audit Logs Button in Logs Tab
old_logs_tab_header = """          {/* TAB 3: ORACLE AUDIT LOGS */}
          {activeTab === 'logs' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>"""

new_logs_tab_header = """          {/* TAB 3: ORACLE AUDIT LOGS */}
          {activeTab === 'logs' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8' }}>
                  REAL-TIME ORACLE AUDIT TRAIL ({auditLogs.length})
                </span>
                <button
                  onClick={clearAuditLogs}
                  style={{
                    background: 'rgba(239, 68, 68, 0.2)',
                    border: '1px solid #ef4444',
                    borderRadius: '6px',
                    padding: '3px 10px',
                    color: '#f87171',
                    fontSize: '10px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  🗑️ CLEAR AUDIT LOGS
                </button>
              </div>"""

code = code.replace(old_logs_tab_header, new_logs_tab_header)

with open('src/components/Web3StakingModal.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("Successfully updated Web3StakingModal.tsx with all 6 features!")
