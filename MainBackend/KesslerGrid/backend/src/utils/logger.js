import fs from 'fs';
import path from 'path';

// Resolve logs directory relative to current working directory
const logDirectory = path.join(process.cwd(), 'logs');

// Ensure the directory exists
if (!fs.existsSync(logDirectory)) {
    fs.mkdirSync(logDirectory, { recursive: true });
}

const logFilePath = path.join(logDirectory, 'watchdog_audit.txt');

// Open a writable stream in append mode ('a')
const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });

/**
 * Standardized audit logging function for the Watchdog Sentinels
 * @param {string} level - Severity (INFO, WARNING, CRITICAL, SUCCESS)
 * @param {string} sentinel - Which watchdog daemon is logging
 * @param {string} message - The audit trail message
 */
export const writeAuditLog = (level, sentinel, message) => {
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] | ${level.toUpperCase()} | ${sentinel.toUpperCase()} | ${message}\n`;

    // Write stream to the text file without locking the process
    logStream.write(entry);

    // Echo to terminal for live monitoring
    console.log(entry.trim());
};