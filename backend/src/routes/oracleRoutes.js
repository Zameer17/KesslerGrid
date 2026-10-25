import { Router } from 'express';
import { executeSlashingPenalty, getAuditLogs } from '../controllers/oracleController.js';

const router = Router();

router.post('/trigger-slash', executeSlashingPenalty);
router.get('/audit-logs', getAuditLogs);

export default router;