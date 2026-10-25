import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';

import satelliteRoutes from './routes/satelliteRoutes.js';
import telemetryRoutes from './routes/telemetryRoutes.js';
import oracleRoutes from './routes/oracleRoutes.js';
import { query } from './config/db.js';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Route Registrations
app.use('/api/v1/telemetry', telemetryRoutes);
app.use('/api/v1/oracle', oracleRoutes);
app.use('/api/v1/satellites', satelliteRoutes);

// GET /api/catalog - Returns catalog satellites from orbital_data
const getSatellitesHandler = async (req, res) => {
  try {
    const result = await query(
      `SELECT norad_cat_id as noradCatId, object_name as objectName, epoch,
              mean_motion as meanMotion, eccentricity, inclination,
              ra_of_asc_node as raOfAscNode, arg_of_pericenter as argOfPericenter,
              mean_anomaly as meanAnomaly, bstar
       FROM orbital_data`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

app.get('/api/catalog', getSatellitesHandler);
app.use('/api/satellites', satelliteRoutes);

// GET /api/conjunctions - Returns active threats where slashing_triggered = 0
const getConjunctionsHandler = async (req, res) => {
  try {
    const result = await query(
      `SELECT id, sat1_id as sat1Id, sat1_name as sat1Name,
              sat2_id as sat2Id, sat2_name as sat2Name,
              miss_distance_km as missDistanceKm, collision_prob as collisionProb,
              threat_level as threatLevel, tca_timestamp as tcaTimestamp,
              slashing_triggered as slashingTriggered, created_at as createdAt
       FROM conjunction_events
       WHERE slashing_triggered = 0
       ORDER BY collision_prob DESC`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

app.get('/api/conjunctions', getConjunctionsHandler);
app.get('/api/v1/conjunctions', getConjunctionsHandler);

// POST /api/admin/reset - Truncates conjunction events and resets demo state
app.post('/api/admin/reset', async (req, res) => {
  try {
    await query('DELETE FROM conjunction_events');
    res.json({ success: true, message: 'Database reset successfully! Conjunction events cleared for live demo.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/demo/trigger-collision - Trigger demo collision conjunction event
app.post('/api/demo/trigger-collision', async (req, res) => {
  try {
    const { primary_sat_id, secondary_sat_id } = req.body;

    if (!primary_sat_id || !secondary_sat_id) {
      return res.status(400).json({ error: 'primary_sat_id and secondary_sat_id are required' });
    }

    const sat1Id = String(primary_sat_id);
    const sat2Id = String(secondary_sat_id);

    const result = await query(
      `INSERT INTO conjunction_events 
       (sat1_id, sat1_name, sat2_id, sat2_name, miss_distance_km, collision_prob, threat_level, slashing_triggered, tca_timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [sat1Id, sat1Id, sat2Id, sat2Id, 0.15, 0.999, 'CRITICAL', 0]
    );

    res.status(201).json({
      success: true,
      message: 'Demo collision event triggered successfully',
      event: {
        id: result.lastID,
        primary_sat_id: sat1Id,
        secondary_sat_id: sat2Id,
        miss_distance_km: 0.15,
        collision_probability: 0.999,
        risk_level: 'CRITICAL',
        slashing_triggered: 0
      }
    });
  } catch (error) {
    console.error('Error in /api/demo/trigger-collision:', error);
    res.status(500).json({ error: 'Failed to trigger demo collision', details: error.message });
  }
});

// PUT /api/satellites/update-status - Update satellite operational status (e.g. DESTROYED)
const updateStatusHandler = async (req, res) => {
  try {
    const { sat_id, sat_ids, operational_status } = req.body;
    const status = operational_status || 'DESTROYED';
    const ids = sat_ids || (sat_id ? [sat_id] : []);

    if (!ids || ids.length === 0) {
      return res.status(400).json({ error: 'sat_id or sat_ids required' });
    }

    const placeholders = ids.map(() => '?').join(',');
    await query(`UPDATE satellites SET operational_status = ? WHERE sat_id IN (${placeholders}) OR norad_cat_id IN (${placeholders}) OR satellite_name IN (${placeholders})`, [status, ...ids, ...ids, ...ids]);

    res.json({ success: true, message: `Status updated to ${status} for ${ids.join(', ')}` });
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ error: error.message });
  }
};

app.put('/api/satellites/update-status', updateStatusHandler);
app.put('/api/v1/satellites/update-status', updateStatusHandler);

// POST /api/demo/reset-state - Flips all DESTROYED satellites back to ACTIVE and clears conjunctions
app.post('/api/demo/reset-state', async (req, res) => {
  try {
    await query("UPDATE satellites SET operational_status = 'ACTIVE' WHERE operational_status = 'DESTROYED'");
    await query('DELETE FROM conjunction_events');
    res.json({ success: true, message: 'Demo state reset successfully! Destroyed satellites restored to ACTIVE.' });
  } catch (error) {
    console.error('Error resetting demo state:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/', (req, res) => {
  res.status(200).json({
    status: 'OK',
    service: 'KesslerGrid Node.js Backend & SQLite Gateway',
    database: 'SQLite (kessler.db)',
    endpoints: [
      '/api/satellites',
      '/api/conjunctions',
      '/api/v1/satellites',
      '/api/v1/conjunctions',
      '/api/demo/trigger-collision',
      '/health'
    ]
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', service: 'KesslerGrid Backend Gateway (SQLite Engine)' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

export default app;