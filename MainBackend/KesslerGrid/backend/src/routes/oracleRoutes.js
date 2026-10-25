import { Router } from 'express';
import { executeSlashingPenalty, getAuditLogs, clearAuditLogs } from '../controllers/oracleController.js';

const router = Router();

router.post('/trigger-slash', executeSlashingPenalty);
router.get('/audit-logs', getAuditLogs);
router.delete('/audit-logs', clearAuditLogs);

export default router;