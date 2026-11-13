import { Router } from 'express';
import claimsRoutes from './claims.routes';
import healthRoutes from './health.routes';
import policiesRoutes from './policies.routes';

const router = Router();

router.use(healthRoutes);
router.use('/policies', policiesRoutes);
router.use('/claims', claimsRoutes);

export default router;
