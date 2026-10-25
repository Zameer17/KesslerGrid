import { startConjunctionWatchdog } from './conjunctionWatchdog.js';
import { startMerkleBatchWatchdog } from './merkleBatchWatchdog.js';
import { startLivenessWatchdog } from './livenessWatchdog.js';
import { writeAuditLog } from '../utils/logger.js';

console.log('🛰️ Starting KesslerGrid Autonomous Watchdog Daemons...');
writeAuditLog('INFO', 'BOOTSTRAP', 'All Watchdog Sentinels started successfully');

startConjunctionWatchdog();
startMerkleBatchWatchdog();
startLivenessWatchdog();