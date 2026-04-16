// services/matching-service.ts
import { config } from '../config/env';

export async function endMatchInMatchingService(matchId: string) {
    try {
        await fetch(`${config.matchingService.baseUrl}/internal/sessions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-internal-service-token': config.matchingService.internalServiceToken,
            },
            body: JSON.stringify({ matchId }),
        });
    } catch (error) {
        console.error('Failed to end match in matching service:', error);
    }
}
