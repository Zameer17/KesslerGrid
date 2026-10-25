import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { checkConjunctionRisk } from './src/services/pythonBridge.js'; // Importing our Python Bridge!

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Network Base Liability Exposure for unregistered/uninsured assets (Hypothetical policy baseline).
 * This is a hypothetical network baseline used only for estimated liability exposure for assets
 * that have no operator-defined on-chain penalty.
 * It is NOT: actual collateral, actual stake, actual penalty, actual payout, actual debt, or actual financial transfer.
 */
export const NETWORK_BASE_LIABILITY_ETH = parseFloat(process.env.NETWORK_BASE_LIABILITY_ETH || '5.0');
console.log(`📋 Network Base Liability Exposure Baseline: ${NETWORK_BASE_LIABILITY_ETH.toFixed(2)} ETH (Hypothetical Off-Chain Baseline)`);

const app = express();
const allowedOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : [])
];
app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (
            allowedOrigins.includes(origin) ||
            /\.netlify\.app$/.test(origin) ||
            process.env.CORS_ALLOW_ALL === 'true' ||
            process.env.NODE_ENV !== 'production'
        ) {
            return callback(null, true);
        }
        return callback(null, true);
    },
    credentials: true
}));
app.use(express.json());

// ---------------------------------------------------------
// 1. WEB3 SMART CONTRACT INITIALIZATION
// ---------------------------------------------------------
let abiPath = path.join(__dirname, '../shared/KesslerGridCore.json');
if (!fs.existsSync(abiPath)) {
    abiPath = path.join(__dirname, 'shared/KesslerGridCore.json');
}

if (fs.existsSync(abiPath)) {
    const contractData = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
    console.log(`✅ KesslerGridCore ABI loaded successfully from: ${abiPath}`);
    console.log(`📍 Contract Address: ${contractData.address}`);
} else {
    console.warn("⚠️ Warning: KesslerGridCore ABI not found in shared folder. Deploy the smart contract first.");
}

// ---------------------------------------------------------
// 2. LIVE SATELLITE FLEET (In-Memory Database for now)
// ---------------------------------------------------------
// 2. SQLITE DATABASE INITIALIZATION (Singleton Pattern)
// ---------------------------------------------------------
import sqlite3Pkg from 'sqlite3';
const sqlite3 = sqlite3Pkg.verbose ? sqlite3Pkg.verbose() : sqlite3Pkg;
const defaultDbPath = fs.existsSync(path.resolve(__dirname, 'kessler.db'))
    ? path.resolve(__dirname, 'kessler.db')
    : path.resolve(__dirname, '../MainBackend/KesslerGrid/backend/kessler.db');
const dbPath = process.env.DB_PATH || defaultDbPath;

export const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Failed to connect to persistent SQLite database:', err.message);
    } else {
        console.log('✅ Persistent SQLite database connection established at:', dbPath);
    }
});

// Configure busy timeout (5000ms) and Write-Ahead Logging (WAL) for concurrency
db.configure('busyTimeout', 5000);
db.run('PRAGMA journal_mode = WAL;', (err) => {
    if (err) {
        console.warn('⚠️ Could not enable WAL mode:', err.message);
    } else {
        console.log('⚡ SQLite WAL (Write-Ahead Logging) mode enabled.');
    }
});

// Helper function to query SQLite kessler.db using singleton connection
const querySQLite = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
};

const runSQLite = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
};

import { ethers } from 'ethers';

// Auto-initialize SQLite Tables (satellites, audit_ledger, conjunction_events) & Safe Non-Destructive Migrations
const initSQLiteDatabase = async () => {
    try {
        // 1. Satellites Table Schema with explicit liability_bond_eth
        await runSQLite(`
            CREATE TABLE IF NOT EXISTS satellites (
                sat_id TEXT PRIMARY KEY,
                operator_address TEXT,
                norad_cat_id INTEGER,
                satellite_name TEXT,
                staked_amount_eth REAL DEFAULT 0.0,
                liability_bond_eth REAL DEFAULT 0.0,
                operational_status TEXT DEFAULT 'ACTIVE',
                registered_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Check if liability_bond_eth column exists in satellites, migrate if missing
        const satCols = await querySQLite("PRAGMA table_info(satellites)");
        const hasLiabilityBondCol = satCols && satCols.some(c => c.name === 'liability_bond_eth');
        if (!hasLiabilityBondCol) {
            await runSQLite("ALTER TABLE satellites ADD COLUMN liability_bond_eth REAL DEFAULT 0.0");
            console.log("✅ SQLite satellites migrated: added liability_bond_eth column");
        } else {
            console.log("✅ SQLite satellites schema verified: liability_bond_eth column present");
        }

        // 2. Audit Ledger Table Schema
        await runSQLite(`
            CREATE TABLE IF NOT EXISTS audit_ledger (
                id INTEGER PRIMARY KEY AUTOINCREMENT, 
                timestamp TEXT, 
                event_type TEXT, 
                primary_asset TEXT, 
                threat_asset TEXT, 
                financial_transfer TEXT, 
                state_change TEXT,
                estimated_liability_exposure_eth REAL DEFAULT NULL,
                tx_hash TEXT DEFAULT NULL
            )
        `);

        // Check if estimated_liability_exposure_eth column exists, migrate if not
        const cols = await querySQLite("PRAGMA table_info(audit_ledger)");
        const hasExposureCol = cols && cols.some(c => c.name === 'estimated_liability_exposure_eth');
        if (!hasExposureCol) {
            await runSQLite("ALTER TABLE audit_ledger ADD COLUMN estimated_liability_exposure_eth REAL DEFAULT NULL");
            console.log("✅ SQLite audit_ledger migrated: added estimated_liability_exposure_eth column (legacy rows preserved with NULL)");
        } else {
            console.log("✅ SQLite audit_ledger schema verified: estimated_liability_exposure_eth column present");
        }

        const hasTxHashCol = cols && cols.some(c => c.name === 'tx_hash');
        if (!hasTxHashCol) {
            await runSQLite("ALTER TABLE audit_ledger ADD COLUMN tx_hash TEXT DEFAULT NULL");
            console.log("✅ SQLite audit_ledger migrated: added tx_hash column (legacy rows preserved with NULL)");
        } else {
            console.log("✅ SQLite audit_ledger schema verified: tx_hash column present");
        }

        // 3. Conjunction Events Table Schema
        await runSQLite(`
            CREATE TABLE IF NOT EXISTS conjunction_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sat1_id TEXT,
                sat1_name TEXT,
                sat2_id TEXT,
                sat2_name TEXT,
                miss_distance_km REAL,
                collision_prob REAL,
                threat_level TEXT,
                slashing_triggered INTEGER DEFAULT 0,
                tca_timestamp TEXT
            )
        `);
    } catch (err) {
        console.warn('⚠️ SQLite tables initialization/migration warning:', err.message);
    }
};
initSQLiteDatabase();

// Helper to execute on-chain collateral slash via Oracle / Admin Wallet
const executeOnChainSlash = async (satKeys) => {
    try {
        if (!fs.existsSync(abiPath)) return null;
        const contractData = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
        const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
        // Admin / Oracle wallet (Hardhat Account #0)
        const oracleWallet = new ethers.Wallet(
            process.env.ORACLE_PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
            provider
        );
        const contract = new ethers.Contract(contractData.address, contractData.abi, oracleWallet);

        const candidates = (Array.isArray(satKeys) ? satKeys : [satKeys])
            .filter(Boolean)
            .map(k => String(k).trim());

        for (const satKey of candidates) {
            try {
                const isReg = await contract.isRegistered(satKey);
                if (!isReg) continue;

                const satInfo = await contract.getSatellite(satKey);
                const stakedWei = satInfo.stakedAmount;
                if (stakedWei <= 0n) continue;

                console.log(`⚡ [Oracle] Executing on-chain slash for "${satKey}" (Staked: ${ethers.formatEther(stakedWei)} ETH)...`);
                const tx = await contract.slash(satKey, 'CRITICAL_COLLISION_PCA');
                const receipt = await tx.wait();
                console.log(`✅ [Oracle] Slash confirmed on-chain! Tx: ${receipt.hash} Block: ${receipt.blockNumber}`);

                return {
                    txHash: receipt.hash,
                    blockNumber: receipt.blockNumber,
                    amountEth: ethers.formatEther(stakedWei),
                    treasury: await contract.penaltyTreasury(),
                    satKey
                };
            } catch (innerErr) {
                console.warn(`⚠️ [Oracle] Error checking/slashing key "${satKey}":`, innerErr.message);
            }
        }
        return null;
    } catch (err) {
        console.warn('⚠️ [Oracle] On-chain slash failed or skipped:', err.message);
        return null;
    }
};

// Endpoint A: Send the satellite list from SQLite DB to React (Flat Array Format)
const fetchSatellitesHandler = async (req, res) => {
    try {
        const rows = await querySQLite('SELECT * FROM satellites ORDER BY registered_at DESC');
        const fleetData = rows || [];
        // Return flat array directly so frontend receives actual database records
        res.json(fleetData);
    } catch (err) {
        console.error('Error fetching satellites from SQLite:', err);
        res.status(500).json({ error: err.message });
    }
};

app.get('/api/satellites', fetchSatellitesHandler);
app.get('/api/v1/satellites', fetchSatellitesHandler);
app.get('/satellites', fetchSatellitesHandler);

// Endpoint A.2: Register / Synchronize Satellite to SQLite DB
const registerSatelliteHandler = async (req, res) => {
    try {
        const satId = req.body.satId || req.body.sat_id;
        const noradId = req.body.noradId || req.body.norad_id || req.body.norad_cat_id;
        const satelliteName = req.body.satelliteName || req.body.satellite_name;
        const operatorAddress = req.body.operatorAddress || req.body.operator_address;
        const stakedEth = req.body.stakedEth !== undefined ? req.body.stakedEth : (req.body.staked_amount_eth !== undefined ? req.body.staked_amount_eth : req.body.staked_eth);
        const liabilityPenaltyEth = req.body.liabilityPenaltyEth !== undefined ? req.body.liabilityPenaltyEth : req.body.liability_penalty_eth;
        const liabilityBondEth = req.body.liabilityBondEth !== undefined ? req.body.liabilityBondEth : req.body.liability_bond_eth;

        const resolvedSatId = String(satId || satelliteName || noradId || 'UNKNOWN').trim();
        const resolvedNoradId = noradId ? parseInt(noradId, 10) : null;
        const resolvedName = (satelliteName || satId || 'UNKNOWN').trim();
        const resolvedOperator = operatorAddress ? operatorAddress.toLowerCase().trim() : 'UNREGISTERED';
        const parsedIncomingStake = stakedEth !== undefined && stakedEth !== null ? parseFloat(stakedEth) : 0.0;

        // 1. Fetch current satellite state first (case-insensitive and trimmed whitespace lookup)
        const existing = await querySQLite(
            `SELECT rowid, sat_id, operator_address, norad_cat_id, satellite_name, staked_amount_eth, liability_bond_eth, operational_status 
             FROM satellites 
             WHERE LOWER(TRIM(sat_id)) = LOWER(TRIM(?)) 
                OR LOWER(TRIM(satellite_name)) = LOWER(TRIM(?)) 
                OR (norad_cat_id IS NOT NULL AND norad_cat_id = ?)`,
            [resolvedSatId, resolvedName, resolvedNoradId]
        );

        // Verify that if existing.length > 0, existingStake correctly pulls the stored staked_amount_eth
        const existingStake = (existing && existing.length > 0) ? parseFloat(existing[0].staked_amount_eth || 0.0) : 0.0;

        // 2. Compute new accumulated stake: existingStake + incomingStake
        const newStakedAmount = existingStake + parsedIncomingStake;

        if (existing && existing.length > 0) {
            // Update existing row (additive staking: strictly update stake, lock liability bond)
            const targetSatId = existing[0].sat_id || resolvedSatId;
            await runSQLite(
                `UPDATE satellites SET 
                    operator_address = ?, 
                    norad_cat_id = COALESCE(?, norad_cat_id), 
                    satellite_name = ?, 
                    staked_amount_eth = ?, 
                    operational_status = 'ACTIVE', 
                    registered_at = datetime('now') 
                 WHERE LOWER(TRIM(sat_id)) = LOWER(TRIM(?)) 
                    OR rowid = ?`,
                [resolvedOperator, resolvedNoradId, resolvedName, newStakedAmount, targetSatId, existing[0].rowid]
            );

            // Consolidate any duplicate rows for the same entity
            if (existing.length > 1) {
                for (let i = 1; i < existing.length; i++) {
                    await runSQLite('DELETE FROM satellites WHERE rowid = ?', [existing[i].rowid]);
                }
            }
        } else {
            // Initial registration: record both initial stake and user-defined liability bond
            const explicitBond = liabilityBondEth !== undefined && liabilityBondEth !== null
                ? parseFloat(liabilityBondEth)
                : (liabilityPenaltyEth !== undefined && liabilityPenaltyEth !== null ? parseFloat(liabilityPenaltyEth) : null);
            const initialLiabilityBond = explicitBond !== null ? explicitBond : (newStakedAmount * 2.0);

            await runSQLite(
                `INSERT INTO satellites (sat_id, operator_address, norad_cat_id, satellite_name, staked_amount_eth, liability_bond_eth, operational_status, registered_at)
                 VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', datetime('now'))`,
                [resolvedSatId, resolvedOperator, resolvedNoradId, resolvedName, newStakedAmount, initialLiabilityBond]
            );
        }

        const savedRows = await querySQLite(
            `SELECT * FROM satellites 
             WHERE LOWER(TRIM(sat_id)) = LOWER(TRIM(?)) 
                OR LOWER(TRIM(satellite_name)) = LOWER(TRIM(?))`,
            [resolvedSatId, resolvedName]
        );

        const currentLiabilityBond = savedRows[0]?.liability_bond_eth ?? (existing[0]?.liability_bond_eth ?? 0.0);

        res.status(200).json({
            success: true,
            message: `Satellite ${resolvedSatId} registered/synchronized successfully in SQLite DB. Staked: ${newStakedAmount} ETH (accumulated), Liability Bond: ${currentLiabilityBond} ETH (locked).`,
            satellite: savedRows[0] || {
                sat_id: resolvedSatId,
                operator_address: resolvedOperator,
                norad_cat_id: resolvedNoradId,
                satellite_name: resolvedName,
                staked_amount_eth: newStakedAmount,
                liability_bond_eth: currentLiabilityBond,
                operational_status: 'ACTIVE'
            }
        });
    } catch (err) {
        console.error('Error registering satellite in SQLite:', err);
        res.status(500).json({ success: false, error: err.message });
    }
};

app.post('/v1/satellites/register', registerSatelliteHandler);
app.post('/api/v1/satellites/register', registerSatelliteHandler);
app.post('/api/satellites/register', registerSatelliteHandler);
app.post(['/api/satellites/stake', '/api/v1/satellites/stake'], registerSatelliteHandler);

// PUT /api/satellites/update-status - Update operational status
const updateStatusHandler = async (req, res) => {
    try {
        const { sat_id, sat_ids, operational_status } = req.body;
        const status = operational_status || 'DESTROYED';
        const ids = sat_ids || (sat_id ? [sat_id] : []);

        if (!ids || ids.length === 0) {
            return res.status(400).json({ error: 'sat_id or sat_ids required' });
        }

        const placeholders = ids.map(() => '?').join(',');
        await runSQLite(
            `UPDATE satellites SET operational_status = ? WHERE sat_id IN (${placeholders}) OR norad_cat_id IN (${placeholders}) OR satellite_name IN (${placeholders})`,
            [status, ...ids, ...ids, ...ids]
        );

        res.json({ success: true, message: `Status updated to ${status} for ${ids.join(', ')}` });
    } catch (err) {
        console.error('Error updating status:', err);
        res.status(500).json({ error: err.message });
    }
};

app.put('/api/satellites/update-status', updateStatusHandler);
app.put('/api/v1/satellites/update-status', updateStatusHandler);

// POST /api/reset and /api/reset-demo - Full Baseline Demo Reset (Clears dynamic rows, preserves schema)
const resetDemoDatabaseHandler = async (req, res) => {
    try {
        await runSQLite("CREATE TABLE IF NOT EXISTS audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, message TEXT, timestamp TEXT);");
        await runSQLite("DELETE FROM satellites;");
        await runSQLite("DELETE FROM audit_logs;");
        try {
            await runSQLite("DELETE FROM conjunction_events;");
        } catch (_) {}
        try {
            await runSQLite("DELETE FROM audit_ledger;");
        } catch (_) {}

        console.log("🧹 [Reset] Safely deleted all rows from satellites, audit logs, conjunction events, and audit ledger.");
        return res.status(200).json({
            success: true,
            message: "Demo state reset successfully. Transient records purged, active assets reset, and audit ledger cleared.",
            entry: null
        });
    } catch (err) {
        console.error("Error executing demo reset:", err);
        return res.status(500).json({ error: err.message });
    }
};

app.post(['/api/reset', '/api/reset-demo', '/api/v1/reset', '/api/v1/reset-demo', '/api/admin/reset'], resetDemoDatabaseHandler);

// POST /api/restore-fleet - Safe Fleet Restoration & Revival (UPDATE, not DELETE)
const restoreFleetHandler = async (req, res) => {
    try {
        await runSQLite("UPDATE satellites SET operational_status = 'NOMINAL' WHERE operational_status = 'DESTROYED';");
        await runSQLite("DELETE FROM audit_logs;");
        try {
            await runSQLite("DELETE FROM conjunction_events;");
        } catch (_) {}
        try {
            await runSQLite("DELETE FROM audit_ledger;");
        } catch (_) {}

        console.log("🟢 [Restore Fleet] Successfully restored destroyed satellites to NOMINAL, cleared conjunction events and audit ledger.");
        return res.status(200).json({
            success: true,
            message: "Fleet restored successfully. All destroyed satellites revived to NOMINAL status and audit ledger cleared.",
            entry: null
        });
    } catch (err) {
        console.error("Error restoring fleet:", err);
        return res.status(500).json({ error: err.message });
    }
};

app.post(['/api/restore-fleet', '/api/v1/restore-fleet', '/api/demo/restore-fleet'], restoreFleetHandler);


// POST /api/demo/reset-state - Selective Demo Revert & Healer
app.post(['/api/demo/reset-state', '/api/v1/demo/reset-state'], async (req, res) => {
    try {
        // 1. Clean up Transient & Debris Records: Purge temporary unregistered or debris rows
        await runSQLite("DELETE FROM satellites WHERE (operator_address = 'UNREGISTERED' OR sat_id LIKE '%DEBRIS%' OR satellite_name LIKE '%DEBRIS%') AND operational_status = 'DESTROYED'");
        await runSQLite("DELETE FROM conjunction_events");
        await runSQLite("DELETE FROM audit_logs");
        await runSQLite("DELETE FROM audit_ledger");

        // 2. Revive Assets: Reset active assets to nominal status
        await runSQLite("UPDATE satellites SET operational_status = 'NOMINAL' WHERE operational_status = 'DESTROYED'");

        res.json({
            success: true,
            message: 'Selective demo state reset completed! Transient records and audit ledger purged, active assets reset to nominal status.',
            entry: null
        });
    } catch (err) {
        console.error('Error resetting demo state:', err);
        res.status(500).json({ error: err.message });
    }
});

// Endpoint B: The AI Watchdog! (Passes data to Python)
app.get('/api/v1/conjunctions', async (req, res) => {
    try {
        // Send our active satellites across the bridge to Python port 8000
        const aiAlerts = await checkConjunctionRisk(activeSatellites);
        res.json(aiAlerts);
    } catch (error) {
        console.error("AI Bridge failed:", error.message);
        res.status(500).json({ error: "AI Engine Offline" });
    }
});

// Endpoint C: Send individual telemetry vectors to the React panel
app.get('/api/v1/telemetry/:satId', (req, res) => {
    const sat = activeSatellites.find(s => s.satId === req.params.satId);
    if (sat) {
        // Generate a quick timestamped log
        res.json([{ timestamp: Date.now(), posX: sat.posX, posY: sat.posY, posZ: sat.posZ }]);
    } else {
        res.json([]);
    }
});

// Endpoint D: Demo Collision Route with Uninsured Surcharge & Audit Ledger Integration
app.post(['/api/demo/trigger-collision', '/api/v1/demo/trigger-collision'], async (req, res) => {
    try {
        const {
            primary_sat_id, secondary_sat_id, base_penalty,
            primaryRegistered, threatRegistered,
            primary_registered, secondary_registered
        } = req.body;

        if (!primary_sat_id || !secondary_sat_id) {
            return res.status(400).json({ error: 'primary_sat_id and secondary_sat_id are required' });
        }

        const sat1Id = String(primary_sat_id);
        const sat2Id = String(secondary_sat_id);

        const pLookup = String(req.body.primary_name || req.body.primary_asset || primary_sat_id).trim();
        const tLookup = String(req.body.secondary_name || req.body.threat_name || req.body.threat_asset || secondary_sat_id).trim();

        const extractDigits = (val) => {
            if (typeof val === 'number') return val;
            const m = String(val || '').match(/\d+/);
            return m ? parseInt(m[0], 10) : null;
        };
        const candidateKeys1 = [sat1Id, pLookup, req.body.primary_name, req.body.primary_asset]
            .filter(Boolean)
            .map(k => String(k).trim().toLowerCase());
        const candidateKeys2 = [sat2Id, tLookup, req.body.secondary_name, req.body.threat_name, req.body.threat_asset]
            .filter(Boolean)
            .map(k => String(k).trim().toLowerCase());

        const pNorad = extractDigits(pLookup);
        const tNorad = extractDigits(tLookup);

        const allSats = await querySQLite('SELECT * FROM satellites');
        const matchAsset = (keys, norad) => {
            return (allSats || []).find(s => {
                const sId = String(s.sat_id || '').toLowerCase().trim();
                const sName = String(s.satellite_name || '').toLowerCase().trim();
                const sNorad = s.norad_cat_id ? parseInt(s.norad_cat_id, 10) : null;
                const sWords = `${sId} ${sName}`.toLowerCase().split(/[\s\-_()]+/).filter(w => w.length >= 3 && w !== 'sat');
                
                return keys.some(k => {
                    const kClean = k.toLowerCase().trim();
                    if (kClean === sId || kClean === sName) return true;
                    if (sId && (kClean.includes(sId) || sId.includes(kClean))) return true;
                    if (sName && (kClean.includes(sName) || sName.includes(kClean))) return true;
                    const kWords = kClean.split(/[\s\-_()]+/).filter(w => w.length >= 3 && w !== 'sat');
                    return kWords.some(w => sWords.some(sw => sw.includes(w) || w.includes(sw)));
                }) || (norad && sNorad && norad === sNorad);
            });
        };

        const primaryRec = matchAsset(candidateKeys1, pNorad);
        const threatRec = matchAsset(candidateKeys2, tNorad);

        const isPrimaryReg = (primaryRegistered !== undefined || primary_registered !== undefined)
            ? Boolean(primaryRegistered ?? primary_registered)
            : Boolean(primaryRec && primaryRec.operator_address && primaryRec.operator_address.toUpperCase() !== 'UNREGISTERED' && primaryRec.operational_status !== 'DESTROYED' && (parseFloat(primaryRec.staked_amount_eth || 0) > 0 || primaryRec.operator_address?.startsWith('0x')));

        const isThreatReg = (threatRegistered !== undefined || secondary_registered !== undefined)
            ? Boolean(threatRegistered ?? secondary_registered)
            : Boolean(threatRec && threatRec.operator_address && threatRec.operator_address.toUpperCase() !== 'UNREGISTERED' && threatRec.operational_status !== 'DESTROYED' && (parseFloat(threatRec.staked_amount_eth || 0) > 0 || threatRec.operator_address?.startsWith('0x')));

        const baseEth = parseFloat(base_penalty || primaryRec?.liability_bond_eth || threatRec?.liability_bond_eth || primaryRec?.liability_penalty_eth || threatRec?.liability_penalty_eth || 2.5);
        let financialTransfer = '';
        let eventType = '';
        let stateChange = '';

        let exposure = null;
        let regAssetName = sat1Id;
        let unregAssetName = sat2Id;

        if (isPrimaryReg && isThreatReg) {
            regAssetName = primaryRec?.satellite_name || primaryRec?.sat_id || sat1Id;
            unregAssetName = threatRec?.satellite_name || threatRec?.sat_id || sat2Id;
            const avoidanceBurnEth = 2.50;

            const pStake = parseFloat(primaryRec?.staked_amount_eth || 0);
            const pRemainingStake = Math.max(0, pStake - avoidanceBurnEth);
            const pRemainingLiability = Math.max(0, pRemainingStake * 2.0);

            const tStake = parseFloat(threatRec?.staked_amount_eth || 0);
            const tRemainingStake = Math.max(0, tStake - avoidanceBurnEth);
            const tRemainingLiability = Math.max(0, tRemainingStake * 2.0);

            // Deduct 2.50 ETH avoidance burn from both assets, keeping operational_status = 'ACTIVE'
            if (primaryRec) {
                await runSQLite(
                    `UPDATE satellites SET 
                        staked_amount_eth = ?, 
                        liability_bond_eth = ?, 
                        operational_status = 'ACTIVE' 
                     WHERE rowid = ?`,
                    [pRemainingStake, pRemainingLiability, primaryRec.rowid]
                );
            }
            if (threatRec) {
                await runSQLite(
                    `UPDATE satellites SET 
                        staked_amount_eth = ?, 
                        liability_bond_eth = ?, 
                        operational_status = 'ACTIVE' 
                     WHERE rowid = ?`,
                    [tRemainingStake, tRemainingLiability, threatRec.rowid]
                );
            }

            const timestamp = new Date().toISOString();
            const timestampB = new Date(Date.now() + 5).toISOString();

            // Insert into conjunction_events
            await runSQLite(
                `INSERT INTO conjunction_events 
                 (sat1_id, sat1_name, sat2_id, sat2_name, miss_distance_km, collision_prob, threat_level, slashing_triggered, tca_timestamp)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [sat1Id, regAssetName, sat2Id, unregAssetName, 2.45, 0.05, 'MITIGATED', 0, timestamp]
            );

            // Log for Asset A (Primary)
            const ledgerResultA = await runSQLite(`
                INSERT INTO audit_ledger (timestamp, event_type, primary_asset, threat_asset, financial_transfer, state_change, estimated_liability_exposure_eth)
                VALUES (?, 'MUTUAL_AVOIDANCE', ?, ?, '2.50 ETH BURN', 'MUTUAL AVOIDANCE EXECUTED', 2.50)
            `, [timestamp, regAssetName, unregAssetName]);

            // Log for Asset B (Threat)
            await runSQLite(`
                INSERT INTO audit_ledger (timestamp, event_type, primary_asset, threat_asset, financial_transfer, state_change, estimated_liability_exposure_eth)
                VALUES (?, 'MUTUAL_AVOIDANCE', ?, ?, '2.50 ETH BURN', 'MUTUAL AVOIDANCE EXECUTED', 2.50)
            `, [timestampB, unregAssetName, regAssetName]);

            console.log(`🛡️ [Scenario A: Mutual Avoidance Trigger] Assets "${regAssetName}" & "${unregAssetName}" executed mutual avoidance (-2.50 ETH burn each, status: ACTIVE).`);

            return res.status(201).json({
                success: true,
                scenario: "MUTUAL_AVOIDANCE",
                collisionType: "MUTUAL_AVOIDANCE",
                message: 'Mutual avoidance executed: both registered assets burned 2.50 ETH and maintained ACTIVE status.',
                registeredAsset: {
                    satId: primaryRec?.sat_id || sat1Id,
                    satelliteName: regAssetName,
                    action: "AVOIDANCE_BURN",
                    burnedAmount: avoidanceBurnEth,
                    remainingStake: pRemainingStake,
                    remainingLiability: pRemainingLiability,
                    status: "ACTIVE"
                },
                threatAsset: {
                    satId: threatRec?.sat_id || sat2Id,
                    satelliteName: unregAssetName,
                    action: "AVOIDANCE_BURN",
                    burnedAmount: avoidanceBurnEth,
                    remainingStake: tRemainingStake,
                    remainingLiability: tRemainingLiability,
                    status: "ACTIVE"
                },
                primaryAsset: {
                    satId: primaryRec?.sat_id || sat1Id,
                    satelliteName: regAssetName,
                    action: "AVOIDANCE_BURN",
                    burnedAmount: avoidanceBurnEth,
                    slashedAmount: 0.0,
                    remainingStake: pRemainingStake,
                    remainingLiability: pRemainingLiability,
                    status: "ACTIVE",
                    coverage: "REGISTERED",
                    isRegistered: true,
                    offChainDebtEth: 0.0,
                    invoiceStatus: "N/A",
                    txHash: null
                },
                event: {
                    primary_sat_id: regAssetName,
                    secondary_sat_id: unregAssetName,
                    miss_distance_km: 2.45,
                    collision_probability: 0.05,
                    risk_level: 'MITIGATED',
                    slashing_triggered: 0
                },
                ledger_entry: {
                    id: ledgerResultA.lastID,
                    timestamp,
                    event_type: 'MUTUAL_AVOIDANCE',
                    primary_asset: regAssetName,
                    threat_asset: unregAssetName,
                    financial_transfer: '2.50 ETH BURN',
                    state_change: 'MUTUAL AVOIDANCE EXECUTED',
                    estimated_liability_exposure_eth: 2.50
                }
            });
        } else if (isPrimaryReg && !isThreatReg) {
            regAssetName = primaryRec?.satellite_name || primaryRec?.sat_id || sat1Id;
            unregAssetName = threatRec?.satellite_name || threatRec?.sat_id || sat2Id;
            eventType = 'ASYMMETRIC_AVOIDANCE';
            financialTransfer = '2.50 ETH BURN';
            stateChange = 'AVOIDANCE MANEUVER EXECUTED';
            exposure = 2.50; // Strictly 2.50 ETH avoidance burn on registered asset, no surcharge
        } else if (!isPrimaryReg && isThreatReg) {
            regAssetName = threatRec?.satellite_name || threatRec?.sat_id || sat2Id;
            unregAssetName = primaryRec?.satellite_name || primaryRec?.sat_id || sat1Id;
            eventType = 'ASYMMETRIC_AVOIDANCE';
            financialTransfer = '2.50 ETH BURN';
            stateChange = 'AVOIDANCE MANEUVER EXECUTED';
            exposure = 2.50; // Strictly 2.50 ETH avoidance burn on registered asset, no surcharge
        } else {
            eventType = 'UNINSURED_TOTAL_LOSS';
            financialTransfer = 'UNINSURED LOSS: 0.00 ETH parametric payout. Total destruction imminent at PCA.';
            stateChange = 'UNINSURED_COLLISION_DESTRUCTION';
            exposure = NETWORK_BASE_LIABILITY_ETH; // Unregistered/uninsured assets: snapshot network baseline
            regAssetName = sat1Id;
            unregAssetName = sat2Id;
        }

        const timestamp = new Date().toISOString();

        // 1. Insert into conjunction_events
        await runSQLite(
            `INSERT INTO conjunction_events 
             (sat1_id, sat1_name, sat2_id, sat2_name, miss_distance_km, collision_prob, threat_level, slashing_triggered, tca_timestamp)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [sat1Id, sat1Id, sat2Id, sat2Id, 0.15, 0.999, 'CRITICAL', 0, timestamp]
        );

        // 2. Insert into immutable audit_ledger with point-in-time estimated exposure snapshot
        const ledgerResult = await runSQLite(
            `INSERT INTO audit_ledger (timestamp, event_type, primary_asset, threat_asset, financial_transfer, state_change, estimated_liability_exposure_eth)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [timestamp, eventType, regAssetName, unregAssetName, financialTransfer, stateChange, exposure]
        );

        res.status(201).json({
            success: true,
            message: 'Demo collision event triggered and recorded in audit ledger',
            event: {
                primary_sat_id: regAssetName,
                secondary_sat_id: unregAssetName,
                miss_distance_km: 0.15,
                collision_probability: 0.999,
                risk_level: 'CRITICAL',
                slashing_triggered: 0
            },
            ledger_entry: {
                id: ledgerResult.lastID,
                timestamp,
                event_type: eventType,
                primary_asset: regAssetName,
                threat_asset: unregAssetName,
                financial_transfer: financialTransfer,
                state_change: stateChange,
                estimated_liability_exposure_eth: exposure
            }
        });
    } catch (error) {
        console.error('Error in /api/demo/trigger-collision:', error);
        res.status(500).json({ error: 'Failed to trigger demo collision', details: error.message });
    }
});

// Endpoint E: Explicit Collision / Liability Assessment with Surcharge Math
app.post(['/api/collision/assess-liability', '/api/v1/collision/assess-liability'], async (req, res) => {
    try {
        const { primary_sat_id, secondary_sat_id, base_penalty } = req.body;
        const sat1Id = String(primary_sat_id || 'UNKNOWN_PRIMARY');
        const sat2Id = String(secondary_sat_id || 'UNKNOWN_THREAT');

        const rows1 = await querySQLite(
            'SELECT * FROM satellites WHERE sat_id = ? OR norad_cat_id = ? OR satellite_name = ?',
            [sat1Id, sat1Id, sat1Id]
        );
        const rows2 = await querySQLite(
            'SELECT * FROM satellites WHERE sat_id = ? OR norad_cat_id = ? OR satellite_name = ?',
            [sat2Id, sat2Id, sat2Id]
        );

        const primaryRec = rows1 && rows1.length > 0 ? rows1[0] : null;
        const threatRec = rows2 && rows2.length > 0 ? rows2[0] : null;

        const isPrimaryReg = primaryRec && primaryRec.operational_status !== 'DESTROYED';
        const isThreatReg = threatRec && threatRec.operational_status !== 'DESTROYED';

        const baseEth = parseFloat(base_penalty || primaryRec?.liability_bond_eth || threatRec?.liability_bond_eth || primaryRec?.liability_penalty_eth || threatRec?.liability_penalty_eth || 2.5);
        let financialTransfer = '';
        let eventType = '';
        let stateChange = '';

        let exposure = null;
        let regName = sat1Id;
        let unregName = sat2Id;

        if (isPrimaryReg && isThreatReg) {
            regName = primaryRec?.satellite_name || primaryRec?.sat_id || sat1Id;
            unregName = threatRec?.satellite_name || threatRec?.sat_id || sat2Id;
            eventType = 'MUTUAL_AVOIDANCE';
            financialTransfer = '2.50 ETH BURN';
            stateChange = 'AVOIDANCE MANEUVER EXECUTED';
            exposure = 2.50;
        } else if (isPrimaryReg && !isThreatReg) {
            regName = primaryRec?.satellite_name || primaryRec?.sat_id || sat1Id;
            unregName = threatRec?.satellite_name || threatRec?.sat_id || sat2Id;
            eventType = 'ASYMMETRIC_AVOIDANCE';
            financialTransfer = '2.50 ETH BURN';
            stateChange = 'AVOIDANCE MANEUVER EXECUTED';
            exposure = 2.50;
        } else if (!isPrimaryReg && isThreatReg) {
            regName = threatRec?.satellite_name || threatRec?.sat_id || sat2Id;
            unregName = primaryRec?.satellite_name || primaryRec?.sat_id || sat1Id;
            eventType = 'ASYMMETRIC_AVOIDANCE';
            financialTransfer = '2.50 ETH BURN';
            stateChange = 'AVOIDANCE MANEUVER EXECUTED';
            exposure = 2.50;
        } else {
            eventType = 'UNINSURED_TOTAL_LOSS';
            financialTransfer = 'UNINSURED LOSS: 0.00 ETH parametric payout. Total destruction imminent at PCA.';
            stateChange = 'UNINSURED_COLLISION_DESTRUCTION';
            exposure = NETWORK_BASE_LIABILITY_ETH; // Unregistered/uninsured assets: snapshot network baseline
            regName = sat1Id;
            unregName = sat2Id;
        }

        const timestamp = new Date().toISOString();
        const result = await runSQLite(
            `INSERT INTO audit_ledger (timestamp, event_type, primary_asset, threat_asset, financial_transfer, state_change, estimated_liability_exposure_eth)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [timestamp, eventType, regName, unregName, financialTransfer, stateChange, exposure]
        );

        res.status(200).json({
            success: true,
            assessment: {
                id: result.lastID,
                timestamp,
                event_type: eventType,
                primary_asset: regName,
                threat_asset: unregName,
                is_primary_registered: Boolean(isPrimaryReg),
                is_threat_registered: Boolean(isThreatReg),
                base_penalty_eth: 2.50,
                surcharge_eth: 0.0,
                total_extracted_eth: 2.50,
                financial_transfer: financialTransfer,
                state_change: stateChange,
                estimated_liability_exposure_eth: exposure
            }
        });
    } catch (err) {
        console.error('Error in /api/collision/assess-liability:', err);
        res.status(500).json({ error: err.message });
    }
});

// Endpoint E2: POST /api/collision/impact - Record physical collision destruction in DB & ledger
const collisionImpactHandler = async (req, res) => {
    try {
        const {
            primary_id, threat_id,
            primary_name, threat_name,
            primary_norad, threat_norad,
            primary_sat_id, secondary_sat_id,
            primary_asset, threat_asset,
            norad_id, threat_norad_id
        } = req.body;

        const extractDigits = (val) => {
            if (typeof val === 'number') return val;
            const m = String(val || '').match(/\d+/);
            return m ? parseInt(m[0], 10) : null;
        };

        const pId = String(primary_id || primary_sat_id || primary_asset || primary_name || 'UNKNOWN_PRIMARY');
        const tId = String(threat_id || secondary_sat_id || threat_asset || threat_name || 'UNKNOWN_THREAT');
        const pName = String(primary_name || primary_asset || primary_id || pId);
        const tName = String(threat_name || threat_asset || threat_id || tId);
        const pNorad = primary_norad || norad_id ? parseInt(primary_norad || norad_id, 10) : extractDigits(pId);
        const tNorad = threat_norad || threat_norad_id ? parseInt(threat_norad || threat_norad_id, 10) : extractDigits(tId);

        // Fetch assets to check registration status and balances
        const getAssetRec = async (id, name, norad) => {
            const noradNum = norad ? parseInt(norad, 10) : null;
            const existing = await querySQLite(
                `SELECT rowid, sat_id, satellite_name, norad_cat_id, operator_address, staked_amount_eth, liability_bond_eth, operational_status FROM satellites 
                 WHERE LOWER(TRIM(sat_id)) = LOWER(TRIM(?)) 
                    OR LOWER(TRIM(satellite_name)) = LOWER(TRIM(?)) 
                    OR LOWER(TRIM(sat_id)) = LOWER(TRIM(?)) 
                    OR LOWER(TRIM(satellite_name)) = LOWER(TRIM(?))
                    OR (norad_cat_id IS NOT NULL AND norad_cat_id = ?)`,
                [id, name, name, id, noradNum]
            );
            return existing && existing.length > 0 ? existing[0] : null;
        };

        const pRec = await getAssetRec(pId, pName, pNorad);
        const tRec = await getAssetRec(tId, tName, tNorad);

        // 1. Fetch exact current balances for both Primary and Threat from SQLite:
        const pStake = parseFloat(pRec?.staked_amount_eth || 0);
        const pLiability = parseFloat(pRec?.liability_bond_eth || (pStake * 2));

        const tStake = parseFloat(tRec?.staked_amount_eth || 0);
        const tLiability = parseFloat(tRec?.liability_bond_eth || (tStake * 2));

        const isPReg = Boolean(pRec && pRec.operator_address && pRec.operator_address !== 'UNREGISTERED' && (pStake > 0 || pRec.operational_status !== 'DESTROYED'));
        const isTReg = Boolean(tRec && tRec.operator_address && tRec.operator_address !== 'UNREGISTERED' && (tStake > 0 || tRec.operational_status !== 'DESTROYED'));

        let collisionType = 'UNREGISTERED_VS_UNREGISTERED';
        if (isPReg && isTReg) {
            collisionType = 'MUTUAL_AVOIDANCE';
        } else if (isPReg && !isTReg) {
            collisionType = 'ASYMMETRIC_AVOIDANCE';
        } else if (!isPReg && isTReg) {
            collisionType = 'ASYMMETRIC_AVOIDANCE';
        }

        const baseLiability = parseFloat(process.env.NETWORK_BASE_LIABILITY_ETH || '5.0'); // 5.0 ETH
        const timestamp = new Date().toISOString();

        // Check if Scenario A (Mutual Avoidance: Both Registered Assets Encounter)
        const isScenarioA = isPReg && isTReg;

        if (isScenarioA) {
            const avoidanceBurnEth = 2.50;
            const pRemainingStake = Math.max(0, pStake - avoidanceBurnEth);
            const pRemainingLiability = Math.max(0, pRemainingStake * 2.0);
            const tRemainingStake = Math.max(0, tStake - avoidanceBurnEth);
            const tRemainingLiability = Math.max(0, tRemainingStake * 2.0);

            // 1. Keep operational_status for BOTH assets as 'ACTIVE' in SQLite database
            if (pRec) {
                await runSQLite(
                    `UPDATE satellites SET 
                        staked_amount_eth = ?, 
                        liability_bond_eth = ?, 
                        operational_status = 'ACTIVE' 
                     WHERE rowid = ?`,
                    [pRemainingStake, pRemainingLiability, pRec.rowid]
                );
            }
            if (tRec) {
                await runSQLite(
                    `UPDATE satellites SET 
                        staked_amount_eth = ?, 
                        liability_bond_eth = ?, 
                        operational_status = 'ACTIVE' 
                     WHERE rowid = ?`,
                    [tRemainingStake, tRemainingLiability, tRec.rowid]
                );
            }

            // 2. Insert two separate rows into audit_ledger
            // Log for Asset A
            const ledgerResultA = await runSQLite(`
                INSERT INTO audit_ledger (timestamp, event_type, primary_asset, threat_asset, financial_transfer, state_change, estimated_liability_exposure_eth)
                VALUES (?, 'MUTUAL_AVOIDANCE', ?, ?, '2.50 ETH BURN', 'MUTUAL AVOIDANCE EXECUTED', 2.50)
            `, [timestamp, pName, tName]);

            // Log for Asset B
            const timestampB = new Date(Date.now() + 5).toISOString();
            await runSQLite(`
                INSERT INTO audit_ledger (timestamp, event_type, primary_asset, threat_asset, financial_transfer, state_change, estimated_liability_exposure_eth)
                VALUES (?, 'MUTUAL_AVOIDANCE', ?, ?, '2.50 ETH BURN', 'MUTUAL AVOIDANCE EXECUTED', 2.50)
            `, [timestampB, tName, pName]);

            console.log(`🛡️ [Scenario A: Mutual Avoidance] Assets "${pName}" & "${tName}" executed mutual avoidance maneuver (-2.50 ETH burn each, status: ACTIVE).`);

            return res.status(200).json({
                success: true,
                scenario: "MUTUAL_AVOIDANCE",
                collisionType: "MUTUAL_AVOIDANCE",
                registeredAsset: {
                    satId: pRec?.sat_id || pId,
                    satelliteName: pName,
                    action: "AVOIDANCE_BURN",
                    burnedAmount: avoidanceBurnEth,
                    remainingStake: pRemainingStake,
                    remainingLiability: pRemainingLiability,
                    status: "ACTIVE",
                    coverage: "REGISTERED"
                },
                threatAsset: {
                    satId: tRec?.sat_id || tId,
                    satelliteName: tName,
                    action: "AVOIDANCE_BURN",
                    burnedAmount: avoidanceBurnEth,
                    remainingStake: tRemainingStake,
                    remainingLiability: tRemainingLiability,
                    status: "ACTIVE",
                    coverage: "REGISTERED"
                },
                primaryAsset: {
                    satId: pRec?.sat_id || pId,
                    satelliteName: pName,
                    action: "AVOIDANCE_BURN",
                    burnedAmount: avoidanceBurnEth,
                    slashedAmount: 0.0,
                    remainingStake: pRemainingStake,
                    remainingLiability: pRemainingLiability,
                    status: "ACTIVE",
                    coverage: "REGISTERED",
                    isRegistered: true,
                    offChainDebtEth: 0.0,
                    invoiceStatus: "N/A",
                    txHash: null
                },
                entry: {
                    id: ledgerResultA?.lastID,
                    timestamp,
                    event_type: "MUTUAL_AVOIDANCE",
                    primary_asset: pName,
                    threat_asset: tName,
                    financial_transfer: "2.50 ETH BURN",
                    state_change: "MUTUAL AVOIDANCE EXECUTED",
                    estimated_liability_exposure_eth: 2.50
                }
            });
        }

        // Check if Scenario C (Asymmetric: 1 Registered vs 1 Unregistered)
        const isScenarioC = (isPReg && !isTReg) || (!isPReg && isTReg);

        if (isScenarioC) {
            const regIsPrimary = isPReg;
            const regRec = regIsPrimary ? pRec : tRec;
            const regSatId = regIsPrimary ? (pRec?.sat_id || pId) : (tRec?.sat_id || tId);
            const regName = regIsPrimary ? pName : tName;
            const regNorad = regIsPrimary ? pNorad : tNorad;
            const regStake = regIsPrimary ? pStake : tStake;
            const regLiability = regIsPrimary ? pLiability : tLiability;

            const unregRec = regIsPrimary ? tRec : pRec;
            const unregSatId = regIsPrimary ? (tRec?.sat_id || tId) : (pRec?.sat_id || pId);
            const unregName = regIsPrimary ? tName : pName;
            const unregNorad = regIsPrimary ? tNorad : pNorad;

            // 1. Registered Asset Evasion:
            // Deduct 2.5 ETH avoidance burn from active stake and maintain status as ACTIVE
            const avoidanceBurnEth = 2.5;
            const regRemainingStake = Math.max(0, regStake - avoidanceBurnEth);
            const regRemainingLiability = Math.max(0, regRemainingStake * 2.0);

            if (regRec) {
                await runSQLite(
                    `UPDATE satellites SET 
                        staked_amount_eth = ?, 
                        liability_bond_eth = ?, 
                        operational_status = 'ACTIVE' 
                     WHERE rowid = ?`,
                    [regRemainingStake, regRemainingLiability, regRec.rowid]
                );
            }

            // Unregistered threat maintains unbacked liability in DB
            if (unregRec) {
                await runSQLite(
                    `UPDATE satellites SET 
                        staked_amount_eth = 0.0, 
                        liability_bond_eth = ?, 
                        operational_status = COALESCE(operational_status, 'UNREGISTERED') 
                     WHERE rowid = ?`,
                    [baseLiability, unregRec.rowid]
                );
            } else {
                await runSQLite(
                    `INSERT INTO satellites (sat_id, satellite_name, norad_cat_id, operational_status, staked_amount_eth, liability_bond_eth, operator_address)
                     VALUES (?, ?, ?, 'UNREGISTERED', 0.0, ?, 'UNREGISTERED')`,
                    [unregSatId, unregName, unregNorad, baseLiability]
                );
            }

            // 2. Explicit audit_ledger record for the mitigated avoidance maneuver:
            const ledgerResult = await runSQLite(
                `INSERT INTO audit_ledger 
                 (timestamp, event_type, primary_asset, threat_asset, financial_transfer, state_change, estimated_liability_exposure_eth)
                 VALUES (?, 'ASYMMETRIC_AVOIDANCE', ?, ?, '2.50 ETH BURN', 'AVOIDANCE MANEUVER EXECUTED', 2.50)`,
                [new Date().toISOString(), regName, unregName]
            );

            console.log(`🛡️ [Scenario C: Asymmetric Avoidance] Asset "${regName}" altered path (-2.50 ETH burn, status: ACTIVE). Unregistered "${unregName}" issued 5.00 ETH debt invoice.`);

            return res.status(200).json({
                success: true,
                scenario: "ASYMMETRIC_AVOIDANCE",
                collisionType: "ASYMMETRIC_AVOIDANCE",
                registeredAsset: {
                    satId: regSatId,
                    satelliteName: regName,
                    action: "AVOIDANCE_BURN",
                    burnedAmount: avoidanceBurnEth,
                    remainingStake: regRemainingStake,
                    remainingLiability: regRemainingLiability,
                    status: "ACTIVE",
                    coverage: "REGISTERED"
                },
                unregisteredThreat: {
                    satId: unregSatId,
                    satelliteName: unregName,
                    action: "OFF_CHAIN_INVOICE",
                    debtAmount: baseLiability,
                    status: "UNPAID INVOICE",
                    coverage: "UNINSURED"
                },
                primaryAsset: regIsPrimary ? {
                    satId: regSatId,
                    satelliteName: regName,
                    action: "AVOIDANCE_BURN",
                    burnedAmount: avoidanceBurnEth,
                    slashedAmount: 0.0,
                    remainingStake: regRemainingStake,
                    remainingLiability: regRemainingLiability,
                    status: "ACTIVE",
                    coverage: "REGISTERED",
                    isRegistered: true,
                    offChainDebtEth: 0.0,
                    invoiceStatus: "N/A",
                    txHash: null
                } : {
                    satId: unregSatId,
                    satelliteName: unregName,
                    action: "OFF_CHAIN_INVOICE",
                    burnedAmount: 0.0,
                    slashedAmount: 0.0,
                    remainingStake: 0.0,
                    remainingLiability: baseLiability,
                    status: "UNPAID INVOICE",
                    coverage: "UNINSURED",
                    isRegistered: false,
                    offChainDebtEth: baseLiability,
                    debtAmount: baseLiability,
                    invoiceStatus: "UNPAID INVOICE",
                    txHash: null
                },
                threatAsset: regIsPrimary ? {
                    satId: unregSatId,
                    satelliteName: unregName,
                    action: "OFF_CHAIN_INVOICE",
                    burnedAmount: 0.0,
                    slashedAmount: 0.0,
                    remainingStake: 0.0,
                    remainingLiability: baseLiability,
                    status: "UNPAID INVOICE",
                    coverage: "UNINSURED",
                    isRegistered: false,
                    offChainDebtEth: baseLiability,
                    debtAmount: baseLiability,
                    invoiceStatus: "UNPAID INVOICE",
                    txHash: null
                } : {
                    satId: regSatId,
                    satelliteName: regName,
                    action: "AVOIDANCE_BURN",
                    burnedAmount: avoidanceBurnEth,
                    slashedAmount: 0.0,
                    remainingStake: regRemainingStake,
                    remainingLiability: regRemainingLiability,
                    status: "ACTIVE",
                    coverage: "REGISTERED",
                    isRegistered: true,
                    offChainDebtEth: 0.0,
                    invoiceStatus: "N/A",
                    txHash: null
                },
                entry: {
                    id: ledgerResult?.lastID,
                    timestamp,
                    event_type: 'ASYMMETRIC_AVOIDANCE_INVOICE',
                    primary_asset: regName,
                    threat_asset: unregName,
                    financial_transfer: '2.50 ETH BURN / 5.0 ETH INVOICE',
                    state_change: 'PATH CHANGED // DEBT ASSIGNED',
                    estimated_liability_exposure_eth: baseLiability
                }
            });
        }

        // Scenario A & Scenario B Execution:
        // 2. Dual Slashing: execute on-chain slash independently for both registered assets
        let pSlashResult = null;
        let tSlashResult = null;

        if (isPReg) {
            pSlashResult = await executeOnChainSlash([pRec?.sat_id, pRec?.satellite_name, pId, pName, pNorad]);
        }

        if (isTReg) {
            // Independent execution - NO short circuiting
            tSlashResult = await executeOnChainSlash([tRec?.sat_id, tRec?.satellite_name, tId, tName, tNorad]);
        }

        const slashedAmountP = pSlashResult ? parseFloat(pSlashResult.amountEth) : pStake;
        const slashedAmountT = tSlashResult ? parseFloat(tSlashResult.amountEth) : tStake;

        // 3. Post-Slash Remaining Amount Calculation:
        const pRemainingStake = isPReg ? Math.max(0, pStake - slashedAmountP) : 0.0;
        const pRemainingLiability = 0.0;

        const tRemainingStake = isTReg ? Math.max(0, tStake - slashedAmountT) : 0.0;
        const tRemainingLiability = 0.0;

        // 4. Update SQLite database records for both satellites with remaining values and DESTROYED status
        if (pRec) {
            await runSQLite(
                `UPDATE satellites SET 
                    staked_amount_eth = ?, 
                    liability_bond_eth = ?, 
                    operational_status = 'DESTROYED' 
                 WHERE rowid = ?`,
                [pRemainingStake, pRemainingLiability, pRec.rowid]
            );
        } else {
            await runSQLite(
                `INSERT INTO satellites (sat_id, satellite_name, norad_cat_id, operational_status, staked_amount_eth, liability_bond_eth, operator_address)
                 VALUES (?, ?, ?, 'DESTROYED', 0.0, 0.0, 'UNREGISTERED')`,
                [pId, pName, pNorad]
            );
        }

        if (tRec) {
            await runSQLite(
                `UPDATE satellites SET 
                    staked_amount_eth = ?, 
                    liability_bond_eth = ?, 
                    operational_status = 'DESTROYED' 
                 WHERE rowid = ?`,
                [tRemainingStake, tRemainingLiability, tRec.rowid]
            );
        } else {
            await runSQLite(
                `INSERT INTO satellites (sat_id, satellite_name, norad_cat_id, operational_status, staked_amount_eth, liability_bond_eth, operator_address)
                 VALUES (?, ?, ?, 'DESTROYED', 0.0, 0.0, 'UNREGISTERED')`,
                [tId, tName, tNorad]
            );
        }

        // 5. Insert destruction / slash entries into audit_ledger
        let ledgerResult = null;

        if (collisionType === 'REGISTERED_VS_REGISTERED') {
            // Dual distinct entries in audit ledger for both slashed assets
            ledgerResult = await runSQLite(
                `INSERT INTO audit_ledger (timestamp, event_type, primary_asset, threat_asset, financial_transfer, state_change, estimated_liability_exposure_eth, tx_hash)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    timestamp,
                    'COLLATERAL_SLASHED',
                    pName,
                    tName,
                    `COLLATERAL SLASHED: ${slashedAmountP.toFixed(2)} ETH transferred to Penalty Reserve on-chain.`,
                    'ON_CHAIN_SETTLEMENT_COMPLETE',
                    null,
                    pSlashResult?.txHash || null
                ]
            );

            await runSQLite(
                `INSERT INTO audit_ledger (timestamp, event_type, primary_asset, threat_asset, financial_transfer, state_change, estimated_liability_exposure_eth, tx_hash)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    new Date(Date.now() + 10).toISOString(),
                    'COLLATERAL_SLASHED',
                    tName,
                    pName,
                    `COLLATERAL SLASHED: ${slashedAmountT.toFixed(2)} ETH transferred to Penalty Reserve on-chain.`,
                    'ON_CHAIN_SETTLEMENT_COMPLETE',
                    null,
                    tSlashResult?.txHash || null
                ]
            );
        } else {
            // Scenario B: Both unregistered -> dual off-chain invoices reflecting 5.0 ETH network baseline
            ledgerResult = await runSQLite(
                `INSERT INTO audit_ledger (timestamp, event_type, primary_asset, threat_asset, financial_transfer, state_change, estimated_liability_exposure_eth)
                 VALUES (?, 'UNINSURED_INVOICE_ISSUED', ?, ?, '0.00 ETH (UNPAID INVOICE)', 'OFF-CHAIN DEBT ASSIGNED', ?)`,
                [timestamp, pName, tName, baseLiability]
            );

            await runSQLite(
                `INSERT INTO audit_ledger (timestamp, event_type, primary_asset, threat_asset, financial_transfer, state_change, estimated_liability_exposure_eth)
                 VALUES (?, 'UNINSURED_INVOICE_ISSUED', ?, ?, '0.00 ETH (UNPAID INVOICE)', 'OFF-CHAIN DEBT ASSIGNED', ?)`,
                [new Date(Date.now() + 10).toISOString(), tName, pName, baseLiability]
            );
        }

        res.status(200).json({
            success: true,
            collisionType,
            scenario: collisionType,
            primaryAsset: {
                satId: pRec?.sat_id || pId,
                satelliteName: pName,
                slashedAmount: isPReg ? slashedAmountP : 0.0,
                remainingStake: pRemainingStake,
                remainingLiability: isPReg ? pRemainingLiability : baseLiability,
                status: 'DESTROYED',
                coverage: isPReg ? 'REGISTERED' : 'UNINSURED',
                isRegistered: Boolean(isPReg),
                offChainDebtEth: !isPReg ? baseLiability : 0.0,
                invoiceStatus: !isPReg ? 'UNPAID INVOICE' : 'N/A',
                txHash: pSlashResult?.txHash || null
            },
            threatAsset: {
                satId: tRec?.sat_id || tId,
                satelliteName: tName,
                slashedAmount: isTReg ? slashedAmountT : 0.0,
                remainingStake: tRemainingStake,
                remainingLiability: isTReg ? tRemainingLiability : baseLiability,
                status: 'DESTROYED',
                coverage: isTReg ? 'REGISTERED' : 'UNINSURED',
                isRegistered: Boolean(isTReg),
                offChainDebtEth: !isTReg ? baseLiability : 0.0,
                invoiceStatus: !isTReg ? 'UNPAID INVOICE' : 'N/A',
                txHash: tSlashResult?.txHash || null
            },
            entry: {
                id: ledgerResult?.lastID,
                timestamp,
                event_type: collisionType === 'REGISTERED_VS_REGISTERED' ? 'COLLATERAL_SLASHED' : 'UNINSURED_INVOICE_ISSUED',
                primary_asset: pName,
                threat_asset: tName
            },
            slashPrimary: pSlashResult,
            slashThreat: tSlashResult
        });
    } catch (err) {
        console.error('Error in /api/collision/impact:', err);
        res.status(500).json({ error: err.message });
    }
};

app.post('/api/collision/impact', collisionImpactHandler);
app.post('/api/v1/collision/impact', collisionImpactHandler);

// Endpoint F: GET /api/audit-logs - Returns the ledger rows, ordered by timestamp DESC
const getAuditLogsHandler = async (req, res) => {
    try {
        const rows = await querySQLite('SELECT * FROM audit_ledger ORDER BY timestamp DESC');
        res.json(rows);
    } catch (err) {
        console.error('Error in GET /api/audit-logs:', err);
        res.status(500).json({ error: err.message });
    }
};

app.get('/api/audit-logs', getAuditLogsHandler);
app.get('/api/v1/audit-logs', getAuditLogsHandler);

// Compatible Oracle logs endpoint
app.get('/api/v1/oracle/audit-logs', async (req, res) => {
    try {
        const rows = await querySQLite('SELECT * FROM audit_ledger ORDER BY timestamp DESC');
        const formattedLogs = rows.map(r => 
            `[${r.timestamp}] [${r.event_type}] ${r.primary_asset} <-> ${r.threat_asset} | ${r.financial_transfer} | Status: ${r.state_change}`
        );
        res.json({ success: true, logs: formattedLogs, entries: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Endpoint G: POST /api/audit-logs - Accepts a new log entry and inserts it with a strict ISO timestamp
const postAuditLogHandler = async (req, res) => {
    try {
        const {
            event_type,
            primary_asset,
            threat_asset,
            financial_transfer,
            state_change,
            estimated_liability_exposure_eth,
            tx_hash,
            message,
            log
        } = req.body;
        const timestamp = new Date().toISOString();
        const eventType = event_type || (financial_transfer ? 'FINANCIAL_TRANSFER' : 'SYSTEM_AUDIT');
        const primAsset = primary_asset || 'N/A';
        const threatAsset = threat_asset || 'N/A';
        const finTransfer = financial_transfer || 'N/A';
        const stateChg = state_change || message || log || 'STATE_RECORDED';
        const txHash = tx_hash || null;

        // Point-in-time snapshot:
        // 1. If explicit estimated_liability_exposure_eth provided, use it
        // 2. If unregistered/uninsured collision event, snapshot NETWORK_BASE_LIABILITY_ETH
        // 3. Otherwise null
        let exposure = null;
        if (estimated_liability_exposure_eth !== undefined && estimated_liability_exposure_eth !== null) {
            exposure = parseFloat(estimated_liability_exposure_eth);
        } else if (
            (eventType === 'UNINSURED_TOTAL_LOSS' || stateChg === 'UNINSURED_COLLISION_DESTRUCTION') &&
            !txHash
        ) {
            exposure = NETWORK_BASE_LIABILITY_ETH;
        }

        const result = await runSQLite(
            `INSERT INTO audit_ledger (timestamp, event_type, primary_asset, threat_asset, financial_transfer, state_change, estimated_liability_exposure_eth, tx_hash)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [timestamp, eventType, primAsset, threatAsset, finTransfer, stateChg, exposure, txHash]
        );

        res.status(201).json({
            success: true,
            message: 'Audit log entry recorded successfully',
            entry: {
                id: result.lastID,
                timestamp,
                event_type: eventType,
                primary_asset: primAsset,
                threat_asset: threatAsset,
                financial_transfer: finTransfer,
                state_change: stateChg,
                estimated_liability_exposure_eth: exposure,
                tx_hash: txHash
            }
        });
    } catch (err) {
        console.error('Error in POST /api/audit-logs:', err);
        res.status(500).json({ error: err.message });
    }
};

app.post('/api/audit-logs', postAuditLogHandler);
app.post('/api/v1/audit-logs', postAuditLogHandler);

// Endpoint H: GET /api/config - Network configuration parameters
app.get('/api/config', (req, res) => {
    res.json({
        network_base_liability_eth: NETWORK_BASE_LIABILITY_ETH,
        description: 'Hypothetical network baseline for estimated liability exposure (uninsured assets)'
    });
});

// ---------------------------------------------------------
// 4. START SERVER
// ---------------------------------------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Node.js Backend running on http://localhost:${PORT}`);
});