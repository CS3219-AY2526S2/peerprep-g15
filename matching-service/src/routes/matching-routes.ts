import { Router } from 'express';
import { MatchingController } from '../controllers/matching-controller';
import { requireAuth } from '../middleware/auth-middleware';

const router = Router();

router.get('/health', MatchingController.health);
router.post('/join', requireAuth, MatchingController.join);
router.post('/leave', requireAuth, MatchingController.leave);
router.get('/status/:userId', requireAuth, MatchingController.status);
router.get('/queue', requireAuth, MatchingController.queue);

export default router;
