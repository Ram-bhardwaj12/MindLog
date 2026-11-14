import { Router } from 'express';
import { getHealth } from '../controllers/health.controller.js';

const router = Router();

// GET /api/health - Public health status check
router.get('/', getHealth);

export default router;

