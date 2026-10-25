import { Router } from 'express';
import { registerSatellite, getAllSatellites, getSatelliteById } from '../controllers/satelliteController.js';

const router = Router();

router.post('/register', registerSatellite);
router.get('/', getAllSatellites);
router.get('/:id', getSatelliteById);

export default router;