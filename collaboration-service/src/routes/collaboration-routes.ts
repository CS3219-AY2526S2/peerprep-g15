import { Router } from 'express';
import {
    createSessionHandler,
    getSessionHandler,
    endSessionHandler,
} from '../controllers/collaboration-controllers';

const router = Router();

router.post('/create', createSessionHandler);
router.get('/room/:roomId', getSessionHandler);
router.delete('/room/:roomId', endSessionHandler);

export default router;
