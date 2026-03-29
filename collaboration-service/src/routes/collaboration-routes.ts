import { Router } from 'express';
import {
    createSessionHandler,
    getSessionHandler,
    endSessionHandler,
} from '../controllers/collaboration-controllers';

const router = Router();

router.post('/', createSessionHandler);
router.get('/:roomId', getSessionHandler);
router.delete('/:roomId', endSessionHandler);

export default router;
