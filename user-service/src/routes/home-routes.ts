import { Router } from 'express';
import { requireAuth } from '../middleware/auth-middleware';
import { HomeController } from '../controllers/home-controller';

export const homeRouter = Router();

homeRouter.get('/', requireAuth, HomeController.home);
