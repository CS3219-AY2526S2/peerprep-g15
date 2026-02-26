import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth-middleware';
import { AdminController } from '../controllers/admin-controller';

export const adminRouter = Router();

adminRouter.get('/home', requireAuth, requireRole('admin'), AdminController.home);
