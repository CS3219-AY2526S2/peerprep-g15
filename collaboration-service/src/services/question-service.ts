// services/question-service.ts
import { config } from '../config/env';
import { Question } from '../types/question';

export async function fetchQuestionById(id: string): Promise<Question | null> {
    const res = await fetch(`${config.questionService.baseUrl}/internal/questions/${id}`, {
        headers: { 'x-internal-service-token': config.questionService.internalServiceToken },
    });

    if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error(`Question service error: ${res.status}`);
    }

    return res.json() as Promise<Question>;
}
