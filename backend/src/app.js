import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';

import satelliteRoutes from './routes/satelliteRoutes.js';
import telemetryRoutes from './routes/telemetryRoutes.js';
import oracleRoutes from './routes/oracleRoutes.js';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Route Registrations
app.use('/api/v1/satellites', satelliteRoutes);
app.use('/api/v1/telemetry', telemetryRoutes);
app.use('/api/v1/oracle', oracleRoutes);

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', service: 'KesslerGrid Backend Gateway' });
});

app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

export default app;