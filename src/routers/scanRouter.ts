/**
 * Scan router: route definitions only. Wires paths to controller methods.
 */

import { Router } from 'express';
import { enqueueScanHandler, getScanStatusHandler } from '../controllers/scanController';

const router = Router();

router.post('/api/scan', enqueueScanHandler);
router.get('/api/scan/:scanId', getScanStatusHandler);

export default router;
