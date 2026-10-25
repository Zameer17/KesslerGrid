import re

with open('src/components/HUDOverlay.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Replace bottom-left combined live indicator and toast bar
old_bottom_left_block = """      {/* Bottom Left Live Indicator & AI Conjunction Risk Banner */}
      <div
        style={{
          position: 'absolute',
          bottom: '32px',
          left: '32px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          pointerEvents: 'auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(10, 15, 25, 0.85)',
            backdropFilter: 'blur(14px)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '8px',
            padding: '8px 16px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
            userSelect: 'none',
          }}
        >
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#47da84',
              animation: 'pulse-live 1.8s infinite ease-in-out',
            }}
          />
          <span
            style={{
              fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
              fontSize: '13px',
              fontWeight: 700,
              letterSpacing: '2px',
              color: '#47da84',
            }}
          >
            LIVE ({totalSatsCount} SATS | SQLITE READY)
          </span>
        </div>

        {/* AI Conjunction Alert Toast Badge */}
        {conjunctionAlerts.length > 0 && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid #ef4444',
              borderRadius: '8px',
              padding: '8px 14px',
              color: '#ffffff',
              fontSize: '11px',
              fontFamily: 'monospace',
              fontWeight: 700,
              boxShadow: '0 0 15px rgba(239, 68, 68, 0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>🚨</span>
            <span>
              AI RISK:{' '}
              {conjunctionAlerts[0]?.sat1Name ??
                conjunctionAlerts[0]?.satA ??
                conjunctionAlerts[0]?.primary_sat_id ??
                'UNKNOWN'}{' '}
              &amp;{' '}
              {conjunctionAlerts[0]?.sat2Name ??
                conjunctionAlerts[0]?.satB ??
                conjunctionAlerts[0]?.secondary_sat_id ??
                'UNKNOWN'}{' '}
              (
              {(
                conjunctionAlerts[0]?.missDistanceKm ??
                (conjunctionAlerts[0] as any)?.distance ??
                0
              ).toFixed(1)}{' '}
              KM)
            </span>
          </div>
        )}
      </div>"""

new_left_panel_block = """      {/* Dedicated Left-Side Sci-Fi AI Conjunction Risk Telemetry Panel */}
      {conjunctionAlerts.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '76px',
            left: '32px',
            width: '360px',
            maxHeight: 'calc(100vh - 210px)',
            background: 'rgba(10, 15, 25, 0.88)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '12px',
            padding: '14px 16px',
            color: '#e2e8f0',
            fontFamily: '"JetBrains Mono", "SF Mono", monospace, sans-serif',
            fontSize: '11px',
            boxShadow: '0 12px 36px rgba(0, 0, 0, 0.75), 0 0 20px rgba(239, 68, 68, 0.15)',
            pointerEvents: 'auto',
            zIndex: 45,
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            overflow: 'hidden',
          }}
        >
          {/* Panel Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid rgba(239, 68, 68, 0.3)',
              paddingBottom: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#ef4444',
                  boxShadow: '0 0 10px #ef4444',
                  animation: 'pulse-live 1.2s infinite ease-in-out',
                }}
              />
              <span
                style={{
                  fontWeight: 800,
                  fontSize: '11px',
                  letterSpacing: '1.2px',
                  color: '#f87171',
                  textTransform: 'uppercase',
                }}
              >
                🛡️ AI CONJUNCTION MONITOR
              </span>
            </div>
            <span
              style={{
                fontSize: '9.5px',
                fontWeight: 700,
                background: 'rgba(239, 68, 68, 0.25)',
                color: '#fca5a5',
                border: '1px solid rgba(239, 68, 68, 0.5)',
                borderRadius: '10px',
                padding: '2px 8px',
              }}
            >
              {conjunctionAlerts.length} THREATS
            </span>
          </div>

          {/* Scrollable Alert Feed Items */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              overflowY: 'auto',
              maxHeight: 'calc(100vh - 270px)',
              paddingRight: '4px',
            }}
          >
            {conjunctionAlerts.slice(0, 10).map((alert, idx) => {
              const sat1 =
                alert.sat1Name ?? alert.satA ?? alert.primary_sat_id ?? 'UNKNOWN';
              const sat2 =
                alert.sat2Name ?? alert.satB ?? alert.secondary_sat_id ?? 'UNKNOWN';
              const dist = (alert.missDistanceKm ?? (alert as any).distance ?? 0).toFixed(1);
              const prob = alert.collisionProb
                ? `${(alert.collisionProb * 100).toFixed(1)}%`
                : 'CRITICAL';

              return (
                <div
                  key={alert.id ?? idx}
                  onClick={() => {
                    if (alert.sat1Id) setFocusedBody(`norad_${alert.sat1Id}`);
                  }}
                  style={{
                    background: 'rgba(30, 41, 59, 0.65)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '8px',
                    padding: '8px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.18)';
                    e.currentTarget.style.borderColor = '#ef4444';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(30, 41, 59, 0.65)';
                    e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                  }}
                >
                  {/* Far-Left Prominent Score Badge */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: '65px',
                      padding: '4px 6px',
                      background: 'rgba(239, 68, 68, 0.25)',
                      border: '1px solid #ef4444',
                      borderRadius: '6px',
                      boxShadow: '0 0 10px rgba(239, 68, 68, 0.3)',
                    }}
                  >
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#ffffff' }}>
                      {prob}
                    </span>
                    <span style={{ fontSize: '8.5px', fontWeight: 700, color: '#fca5a5' }}>
                      {dist} KM
                    </span>
                  </div>

                  {/* Middle Intersecting Satellites Info */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#f8fafc' }}>
                      {sat1} <span style={{ color: '#ef4444' }}>↔</span> {sat2}
                    </div>
                    <div style={{ fontSize: '9px', color: 'rgba(255, 255, 255, 0.55)' }}>
                      STATUS: {alert.slashingTriggered ? 'SLASHED ON-CHAIN' : 'CONJUNCTION ALERT'}
                    </div>
                  </div>

                  {/* Right Status Badge */}
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
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottom Left Live Status Indicator */}
      <div
        style={{
          position: 'absolute',
          bottom: '32px',
          left: '32px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(10, 15, 25, 0.85)',
          backdropFilter: 'blur(14px)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '8px',
          padding: '8px 16px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
          userSelect: 'none',
          pointerEvents: 'auto',
        }}
      >
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: '#47da84',
            animation: 'pulse-live 1.8s infinite ease-in-out',
          }}
        />
        <span
          style={{
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
            fontSize: '13px',
            fontWeight: 700,
            letterSpacing: '2px',
            color: '#47da84',
          }}
        >
          LIVE ({totalSatsCount} SATS | SQLITE READY)
        </span>
      </div>"""

if old_bottom_left_block in code:
    code_updated = code.replace(old_bottom_left_block, new_left_panel_block)
    with open('src/components/HUDOverlay.tsx', 'w', encoding='utf-8') as f:
        f.write(code_updated)
    print("Successfully replaced bottom-left warning toast with dedicated Left-Side AI Risk Telemetry Panel!")
else:
    print("Failed to match old_bottom_left_block precisely.")
