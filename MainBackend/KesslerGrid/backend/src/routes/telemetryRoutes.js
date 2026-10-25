import { Router } from 'express';
import { ingestTelemetry, getLatestTelemetry, anchorBatchOnChain } from '../controllers/telemetryController.js';

const router = Router();

router.post('/ingest', ingestTelemetry);
router.get('/:satId/latest', getLatestTelemetry);
router.post('/anchor-batch', anchorBatchOnChain);

export default router;