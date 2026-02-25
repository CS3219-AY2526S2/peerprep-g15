import { Router } from 'express';
import { AdminController } from '../controllers/admin-controller';
import { requireAuth, requireRole } from '../middleware/auth-middleware';

export const adminRouter = Router();

// Admin “home” page for now
adminRouter.get('/home', requireAuth, requireRole('admin'), AdminController.home);
