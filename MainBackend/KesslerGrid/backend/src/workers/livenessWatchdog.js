import cron from 'node-cron';
import { query } from '../config/db.js';
import { writeAuditLog } from '../utils/logger.js';

export const startLivenessWatchdog = () => {
    // Runs every 30 seconds
    cron.schedule('*/30 * * * * *', async () => {
        try {
            const tenMinutesAgo = Date.now() - (10 * 60 * 1000);

            const sql = `
                UPDATE satellites 
                SET operational_status = 'WARNING'
                WHERE sat_id IN (
                    SELECT s.sat_id FROM satellites s
                    LEFT JOIN telemetry_logs t ON s.sat_id = t.sat_id
                    WHERE s.operational_status = 'ACTIVE'
                    GROUP BY s.sat_id
                    HAVING MAX(t.epoch_timestamp) < $1 OR MAX(t.epoch_timestamp) IS NULL
                )
                RETURNING sat_id;
            `;
            const result = await query(sql, [tenMinutesAgo]);

            if (result.rowCount > 0) {
                const flaggedIds = result.rows.map(r => r.sat_id).join(', ');
                writeAuditLog('WARNING', 'LIVENESS_SENTINEL', `Flagged silent satellite(s) to WARNING: ${flaggedIds}`);
            }
        } catch (err) {
            writeAuditLog('WARNING', 'LIVENESS_SENTINEL', `Liveness check error: ${err.message}`);
        }
    });
};