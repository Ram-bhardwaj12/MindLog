import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import entryRoutes from './entry.routes.js';
import { noCache } from '../middleware/noCache.js';

const apiRouter = Router();

// Mount feature routers under /api
apiRouter.use('/health', healthRoutes);

// Auth and Journal entry routes must never be cached by clients, CDNs, or proxies
apiRouter.use('/auth', noCache, authRoutes);
apiRouter.use('/entries', noCache, entryRoutes);

export default apiRouter;
