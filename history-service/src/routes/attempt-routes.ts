import { Router } from 'express';
import { AttemptController } from '../controllers/attempt-controller';

const router = Router();

router.get('/health', AttemptController.health);
router.post('/save-attempt', AttemptController.save);
router.get('/users/:userId/attempts', AttemptController.listByUser);

export default router;
