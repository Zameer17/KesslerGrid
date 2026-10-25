import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, '../../kessler.db');

sqlite3.verbose();
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Failed to open SQLite database:', err.message);
  } else {
    console.log(`✅ SQLite Database connected at: ${dbPath}`);
  }
});

// Auto-initialize SQLite Tables
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS satellites (
      sat_id TEXT PRIMARY KEY,
      operator_address TEXT,
      norad_cat_id INTEGER,
      satellite_name TEXT,
      staked_amount_eth REAL DEFAULT 0.0,
      liability_bond_eth REAL DEFAULT 0.0,
      liability_penalty_eth REAL DEFAULT 5.0,
      operational_status TEXT DEFAULT 'ACTIVE',
      registered_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Ensure liability_bond_eth and liability_penalty_eth columns exist for existing databases
  db.run(`ALTER TABLE satellites ADD COLUMN liability_bond_eth REAL DEFAULT 0.0`, (err) => {
    // Ignore error if column already exists
  });
  db.run(`ALTER TABLE satellites ADD COLUMN liability_penalty_eth REAL DEFAULT 5.0`, (err) => {
    // Ignore error if column already exists
  });

  // Pre-seed default registered active satellites if empty
  db.run(`
    INSERT OR IGNORE INTO satellites (sat_id, operator_address, norad_cat_id, satellite_name, staked_amount_eth, liability_penalty_eth, operational_status)
    VALUES 
      ('ISS-25544', '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266', 25544, 'ISS (ZARYA)', 10.0, 5.0, 'ACTIVE'),
      ('HST-20580', '0x70997970c51812dc3a010c7d01b50e0d17dc79c8', 20580, 'HUBBLE SPACE TELESCOPE', 5.0, 5.0, 'ACTIVE'),
      ('SENTINEL-60124', '0x3c44cddddb6a900fa2b585dd299e03d12fa4293e', 60124, 'SENTINEL-X RECON', 2.5, 5.0, 'ACTIVE')
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS telemetry_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sat_id TEXT,
      epoch_timestamp BIGINT,
      pos_x REAL,
      pos_y REAL,
      pos_z REAL,
      vel_x REAL,
      vel_y REAL,
      vel_z REAL,
      is_anchored BOOLEAN DEFAULT 0,
      merkle_root_hash TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS conjunction_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sat_a TEXT,
      sat_b TEXT,
      risk_score REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS audit_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT,
      event_type TEXT,
      primary_asset TEXT,
      threat_asset TEXT,
      financial_transfer TEXT,
      state_change TEXT,
      estimated_liability_exposure_eth REAL DEFAULT NULL
    )
  `);

  // Migration: ensure estimated_liability_exposure_eth exists on existing database
  db.all("PRAGMA table_info(audit_ledger)", [], (err, cols) => {
    if (!err && cols && !cols.some(c => c.name === 'estimated_liability_exposure_eth')) {
      db.run("ALTER TABLE audit_ledger ADD COLUMN estimated_liability_exposure_eth REAL DEFAULT NULL");
    }
  });

  // Seed default demo satellites if database is brand new
  db.get('SELECT COUNT(*) as count FROM satellites', [], (err, row) => {
    if (!err && row && row.count === 0) {
      const seedStmt = db.prepare(`
        INSERT INTO satellites (sat_id, operator_address, norad_cat_id, satellite_name, staked_amount_eth, operational_status)
        VALUES (?, ?, ?, ?, ?, 'ACTIVE')
      `);
      seedStmt.run('ISS-ZARYA', '0x38b76aa982fc25d19a82d019f7762a48', 25544, 'ISS (ZARYA)', 42.85);
      seedStmt.run('STARLINK-1007', '0x71c8392f8631a9148d5b91c8407b12903', 44713, 'STARLINK-1007', 5.28);
      seedStmt.run('COSMOS-2558', '0x55b82740921820193892104958102948', 53323, 'COSMOS 2558', 18.57);
      seedStmt.finalize();
      console.log('🌱 Seeded default satellite records in SQLite database');
    }
  });
});

/**
 * Universal Promise-based query helper compatible with Node-Postgres API syntax
 */
export const query = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    const trimmed = sql.trim().toUpperCase();

    // Convert $1, $2, $3 Postgres style parameters to ? SQLite style if present
    let sqliteSql = sql.replace(/\$\d+/g, '?');

    // Handle Postgres-specific array matching (WHERE id = ANY($1::bigint[]))
    if (sqliteSql.includes('ANY(?)') || sqliteSql.includes('ANY(?::BIGINT[])')) {
      if (Array.isArray(params[1])) {
        const placeholders = params[1].map(() => '?').join(',');
        sqliteSql = sqliteSql.replace(/ANY\(\?\:\:BIGINT\[\]\)|ANY\(\?\)/gi, `(${placeholders})`);
        const flatParams = [params[0], ...params[1]];
        params = flatParams;
      }
    }

    if (trimmed.startsWith('SELECT')) {
      db.all(sqliteSql, params, (err, rows) => {
        if (err) return reject(err);
        resolve({ rows, rowCount: rows.length });
      });
    } else if (trimmed.startsWith('INSERT') || trimmed.startsWith('UPDATE') || trimmed.startsWith('DELETE')) {
      db.run(sqliteSql, params, function (err) {
        if (err) {
          // Handle SQLite unique constraint error code
          if (err.code === 'SQLITE_CONSTRAINT' || err.message.includes('UNIQUE')) {
            err.code = '23505'; // Postgres unique violation error code alias
          }
          return reject(err);
        }
        resolve({
          rows: [{ id: this.lastID }],
          rowCount: this.changes,
          lastID: this.lastID,
        });
      });
    } else {
      db.exec(sqliteSql, (err) => {
        if (err) return reject(err);
        resolve({ rows: [], rowCount: 0 });
      });
    }
  });
};

export default db;