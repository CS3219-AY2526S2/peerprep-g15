import { config } from '../config/env';

let collabFetch: typeof fetch = fetch;

export function setCollabServiceFetch(nextFetch?: typeof fetch) {
    collabFetch = nextFetch ?? fetch;
}

export async function createCollabSession(roomId: string, userIds: string[], questionId: string) {
    try {
        const res = await collabFetch(`${config.collaborationService.baseUrl}/internal/sessions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-internal-service-token': config.internal.serviceToken,
            },
            body: JSON.stringify({ roomId, userIds, questionId }),
        });

        if (!res.ok) {
            console.error('Failed to create collab session:', res.status);
        }
    } catch (error) {
        console.error('Failed to reach collab service:', error);
    }
}
