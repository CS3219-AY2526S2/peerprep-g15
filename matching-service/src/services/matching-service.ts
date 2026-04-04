import { randomUUID } from 'crypto';
import type { MatchRequest, MatchResult, QueueEntry, QueueStatus } from '../models/matching-model';

const queueByCriteria = new Map<string, QueueEntry[]>();
const matchByUserId = new Map<string, MatchResult>();

// Normalizes topic+difficulty into a stable bucket key for queue grouping.
function createCriteriaKey(topic: string, difficulty: string) {
    return `${topic.trim().toLowerCase()}::${difficulty}`;
}

// Computes priority distance; lower is better, and missing proficiency is lowest priority.
function getPriorityDistance(joiningUser: QueueEntry, waitingUser: QueueEntry) {
    if (
        typeof joiningUser.proficiency !== 'number' ||
        typeof waitingUser.proficiency !== 'number'
    ) {
        return Number.POSITIVE_INFINITY;
    }

    return Math.abs(joiningUser.proficiency - waitingUser.proficiency);
}

// Selects the best waiting candidate by closest proficiency, then FIFO on ties.
export function pickBestWaitingUserIndex(queue: QueueEntry[], joiningUser: QueueEntry) {
    if (queue.length === 0) return -1;

    let bestIndex = 0;
    let bestDistance = getPriorityDistance(joiningUser, queue[0]);
    let bestJoinedAt = new Date(queue[0].joinedAt).getTime();

    for (let index = 1; index < queue.length; index += 1) {
        const candidate = queue[index];
        const candidateDistance = getPriorityDistance(joiningUser, candidate);
        const candidateJoinedAt = new Date(candidate.joinedAt).getTime();

        if (candidateDistance < bestDistance) {
            bestIndex = index;
            bestDistance = candidateDistance;
            bestJoinedAt = candidateJoinedAt;
            continue;
        }

        if (candidateDistance === bestDistance && candidateJoinedAt < bestJoinedAt) {
            bestIndex = index;
            bestJoinedAt = candidateJoinedAt;
        }
    }

    return bestIndex;
}

// Removes a specific user from whichever criteria queue they are currently waiting in.
function findQueuedUser(userId: string) {
    for (const [criteriaKey, queue] of queueByCriteria.entries()) {
        const index = queue.findIndex((entry) => entry.userId === userId);
        if (index >= 0) {
            const [entry] = queue.splice(index, 1);
            if (queue.length === 0) {
                queueByCriteria.delete(criteriaKey);
            } else {
                queueByCriteria.set(criteriaKey, queue);
            }
            return entry;
        }
    }

    return null;
}

// Attempts to match immediately from the same criteria bucket; otherwise enqueues the user.
export function joinQueue(request: MatchRequest) {
    const criteriaKey = createCriteriaKey(request.topic, request.difficulty);
    const existingQueue = queueByCriteria.get(criteriaKey) ?? [];
    const entry: QueueEntry = {
        ...request,
        topic: request.topic.trim(),
        joinedAt: new Date().toISOString(),
    };

    const waitingUserIndex = pickBestWaitingUserIndex(existingQueue, entry);
    const waitingUser = waitingUserIndex >= 0 ? existingQueue.splice(waitingUserIndex, 1)[0] : undefined;
    if (waitingUser) {
        const match: MatchResult = {
            matchId: randomUUID(),
            userIds: [waitingUser.userId, entry.userId],
            topic: entry.topic,
            difficulty: entry.difficulty,
            createdAt: new Date().toISOString(),
        };

        matchByUserId.set(waitingUser.userId, match);
        matchByUserId.set(entry.userId, match);

        if (existingQueue.length > 0) {
            queueByCriteria.set(criteriaKey, existingQueue);
        } else {
            queueByCriteria.delete(criteriaKey);
        }

        return { state: 'matched' as const, match };
    }

    existingQueue.push(entry);
    queueByCriteria.set(criteriaKey, existingQueue);

    return { state: 'queued' as const, entry };
}

// Removes a user from queue and reports whether anything was removed.
export function leaveQueue(userId: string) {
    const removed = findQueuedUser(userId);
    if (!removed) {
        return false;
    }

    return true;
}

// Returns matched/queued/not_found state for a given user.
export function getQueueStatus(userId: string): QueueStatus {
    const match = matchByUserId.get(userId);
    if (match) {
        return {
            userId,
            state: 'matched',
            match,
        };
    }

    for (const queue of queueByCriteria.values()) {
        const entry = queue.find((item) => item.userId === userId);
        if (entry) {
            return {
                userId,
                state: 'queued',
                entry,
            };
        }
    }

    return {
        userId,
        state: 'not_found',
    };
}

// Flattens all criteria buckets into a single queue snapshot for debugging/admin views.
export function listQueuedUsers() {
    return Array.from(queueByCriteria.values()).flat();
}

// Clears in-memory state for deterministic tests and local resets.
export function resetMatchingState() {
    queueByCriteria.clear();
    matchByUserId.clear();
}
