import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import entryRoutes from './entry.routes.js';

const apiRouter = Router();

// Mount feature routers under /api
apiRouter.use('/health', healthRoutes);
apiRouter.use('/auth', authRoutes);
apiRouter.use('/entries', entryRoutes);

export default apiRouter;

