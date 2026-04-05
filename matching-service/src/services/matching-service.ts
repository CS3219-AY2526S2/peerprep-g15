import { randomUUID } from 'crypto';
import {
    MatchModel,
    QueueModel,
    matchDocumentToResult,
    queueDocumentToEntry,
} from '../models/matching-persistence-model';
import type { MatchRequest, MatchResult, QueueEntry, QueueStatus } from '../models/matching-model';

export interface MatchingRepository {
    clear(): Promise<void>;
    purgeTimedOut(nowMs: number): Promise<void>;
    getMatchByUserId(userId: string): Promise<MatchResult | null>;
    getQueuedUserEntry(userId: string): Promise<QueueEntry | null>;
    listQueuedUsers(nowMs: number): Promise<QueueEntry[]>;
    enqueue(entry: QueueEntry): Promise<void>;
    removeQueuedUser(userId: string): Promise<QueueEntry | null>;
    saveMatch(match: MatchResult): Promise<void>;
}

const TOPIC_EXPANSION_WAIT_MS = 15_000;
const FIFO_EXPANSION_WAIT_MS = 30_000;
const QUEUE_TIMEOUT_MS = 60_000;

class MongoMatchingRepository implements MatchingRepository {
    async clear() {
        await Promise.all([QueueModel.deleteMany({}), MatchModel.deleteMany({})]);
    }

    async purgeTimedOut(nowMs: number) {
        const cutoff = new Date(nowMs - QUEUE_TIMEOUT_MS);
        await QueueModel.deleteMany({ joinedAt: { $lte: cutoff } });
    }

    async getMatchByUserId(userId: string) {
        const document = await MatchModel.findOne({ userIds: userId }).lean();
        return document ? matchDocumentToResult(document) : null;
    }

    async getQueuedUserEntry(userId: string) {
        const document = await QueueModel.findOne({ userId }).lean();
        return document ? queueDocumentToEntry(document) : null;
    }

    async listQueuedUsers(nowMs: number) {
        await this.purgeTimedOut(nowMs);
        const documents = await QueueModel.find({}).sort({ joinedAt: 1 }).lean();
        return documents.map((document) => queueDocumentToEntry(document));
    }

    async enqueue(entry: QueueEntry) {
        await QueueModel.create({
            ...entry,
            topic: entry.topic.trim(),
            joinedAt: new Date(entry.joinedAt),
        });
    }

    async removeQueuedUser(userId: string) {
        const document = await QueueModel.findOneAndDelete({ userId }).lean();
        return document ? queueDocumentToEntry(document) : null;
    }

    async saveMatch(match: MatchResult) {
        await MatchModel.create({
            ...match,
            createdAt: new Date(match.createdAt),
        });
    }
}

class InMemoryMatchingRepository implements MatchingRepository {
    private readonly queueByCriteria = new Map<string, QueueEntry[]>();

    private readonly matchByUserId = new Map<string, MatchResult>();

    async clear() {
        this.queueByCriteria.clear();
        this.matchByUserId.clear();
    }

    async purgeTimedOut(nowMs: number) {
        for (const [criteriaKey, queue] of this.queueByCriteria.entries()) {
            const activeQueue = queue.filter((entry) => !isTimedOut(entry, nowMs));
            if (activeQueue.length === 0) {
                this.queueByCriteria.delete(criteriaKey);
                continue;
            }

            this.queueByCriteria.set(criteriaKey, activeQueue);
        }
    }

    async getMatchByUserId(userId: string) {
        return this.matchByUserId.get(userId) ?? null;
    }

    async getQueuedUserEntry(userId: string) {
        for (const queue of this.queueByCriteria.values()) {
            const entry = queue.find((item) => item.userId === userId);
            if (entry) {
                return entry;
            }
        }

        return null;
    }

    async listQueuedUsers(nowMs: number) {
        await this.purgeTimedOut(nowMs);
        return Array.from(this.queueByCriteria.values()).flat();
    }

    async enqueue(entry: QueueEntry) {
        const criteriaKey = createCriteriaKey(entry.topic, entry.difficulty);
        const existingQueue = this.queueByCriteria.get(criteriaKey) ?? [];
        existingQueue.push(entry);
        this.queueByCriteria.set(criteriaKey, existingQueue);
    }

    async removeQueuedUser(userId: string) {
        for (const [criteriaKey, queue] of this.queueByCriteria.entries()) {
            const index = queue.findIndex((entry) => entry.userId === userId);
            if (index >= 0) {
                const [entry] = queue.splice(index, 1);
                if (queue.length === 0) {
                    this.queueByCriteria.delete(criteriaKey);
                } else {
                    this.queueByCriteria.set(criteriaKey, queue);
                }

                return entry;
            }
        }

        return null;
    }

    async saveMatch(match: MatchResult) {
        this.matchByUserId.set(match.userIds[0], match);
        this.matchByUserId.set(match.userIds[1], match);
    }
}

let repository: MatchingRepository = new MongoMatchingRepository();

export function createInMemoryMatchingRepository() {
    return new InMemoryMatchingRepository();
}

// Matching policy: t = 0 exact match, t = 15s topic-only expansion,
// t = 30s FIFO fallback expansion, t = 60s give up and timeout.
// Within each stage, longest-waiting eligible user is selected for fairness.
export function setMatchingRepository(nextRepository?: MatchingRepository) {
    repository = nextRepository ?? new MongoMatchingRepository();
}

// Normalizes topic+difficulty into a stable bucket key for queue grouping.
function createCriteriaKey(topic: string, difficulty: string) {
    return `${topic.trim().toLowerCase()}::${difficulty}`;
}

// Returns how long a queued user has waited in milliseconds.
function getWaitedMs(entry: QueueEntry, nowMs: number) {
    return Math.max(0, nowMs - new Date(entry.joinedAt).getTime());
}

// Determines if a queued user has exceeded the maximum wait time and should be timed out.
function isTimedOut(entry: QueueEntry, nowMs: number) {
    return getWaitedMs(entry, nowMs) >= QUEUE_TIMEOUT_MS;
}

// Removes timed-out users from all queues so they are never considered for matching.
// Assigns candidate stage: 0 exact match, 1 topic-only after wait, 2 FIFO fallback after longer wait.
function getMatchStage(joiningUser: QueueEntry, candidate: QueueEntry, nowMs: number) {
    const sameTopic =
        candidate.topic.trim().toLowerCase() === joiningUser.topic.trim().toLowerCase();
    const sameDifficulty = candidate.difficulty === joiningUser.difficulty;

    if (sameTopic && sameDifficulty) {
        return 0;
    }

    const waitedMs = getWaitedMs(candidate, nowMs);
    if (sameTopic && waitedMs >= TOPIC_EXPANSION_WAIT_MS) {
        return 1;
    }

    if (waitedMs >= FIFO_EXPANSION_WAIT_MS) {
        return 2;
    }

    return null;
}

// Selects best waiting user within one queue by stage priority then FIFO by joined time.
export function pickBestWaitingUserIndex(
    queue: QueueEntry[],
    joiningUser: QueueEntry,
    nowMs = Date.now(),
) {
    if (queue.length === 0) return -1;

    let bestIndex = -1;
    let bestStage: number | null = null;
    let bestJoinedAt = Number.POSITIVE_INFINITY;

    for (let index = 0; index < queue.length; index += 1) {
        const candidate = queue[index];
        const stage = getMatchStage(joiningUser, candidate, nowMs);
        if (stage === null) continue;

        const joinedAtMs = new Date(candidate.joinedAt).getTime();
        if (
            bestStage === null ||
            stage < bestStage ||
            (stage === bestStage && joinedAtMs < bestJoinedAt)
        ) {
            bestIndex = index;
            bestStage = stage;
            bestJoinedAt = joinedAtMs;
        }
    }

    return bestIndex;
}

// Removes a specific user from whichever criteria queue they are currently waiting in.
// Finds and removes the best eligible waiting user across all queues.
function findBestWaitingCandidate(queue: QueueEntry[], joiningUser: QueueEntry, nowMs: number) {
    let selectedCriteriaKey: string | null = null;
    let selectedIndex = -1;
    let selectedStage: number | null = null;
    let selectedJoinedAt = Number.POSITIVE_INFINITY;

    for (let index = 0; index < queue.length; index += 1) {
        const candidate = queue[index];
        if (candidate.userId === joiningUser.userId) {
            continue;
        }

        const stage = getMatchStage(joiningUser, candidate, nowMs);
        if (stage === null) continue;

        const joinedAtMs = new Date(candidate.joinedAt).getTime();
        if (
            selectedStage === null ||
            stage < selectedStage ||
            (stage === selectedStage && joinedAtMs < selectedJoinedAt)
        ) {
            selectedCriteriaKey = createCriteriaKey(candidate.topic, candidate.difficulty);
            selectedIndex = index;
            selectedStage = stage;
            selectedJoinedAt = joinedAtMs;
        }
    }

    if (selectedCriteriaKey === null || selectedIndex < 0) {
        return undefined;
    }

    return queue[selectedIndex];
}

// Attempts to match immediately from staged policy; otherwise enqueues the user.
export async function joinQueue(request: MatchRequest, nowMs = Date.now()) {
    await repository.purgeTimedOut(nowMs);

    const existingMatch = await repository.getMatchByUserId(request.userId);
    if (existingMatch) {
        return { state: 'matched' as const, match: existingMatch };
    }

    const existingQueuedEntry = await repository.getQueuedUserEntry(request.userId);
    if (existingQueuedEntry) {
        return { state: 'queued' as const, entry: existingQueuedEntry };
    }

    const entry: QueueEntry = {
        ...request,
        topic: request.topic.trim(),
        joinedAt: new Date(nowMs).toISOString(),
    };

    const queuedUsers = await repository.listQueuedUsers(nowMs);
    const waitingUser = findBestWaitingCandidate(queuedUsers, entry, nowMs);
    if (waitingUser) {
        const match: MatchResult = {
            matchId: randomUUID(),
            userIds: [waitingUser.userId, entry.userId],
            topic: entry.topic,
            difficulty: entry.difficulty,
            createdAt: new Date(nowMs).toISOString(),
        };

        await repository.removeQueuedUser(waitingUser.userId);
        await repository.saveMatch(match);

        return { state: 'matched' as const, match };
    }

    await repository.enqueue(entry);

    return { state: 'queued' as const, entry };
}

// Removes a user from queue and reports whether anything was removed.
export async function leaveQueue(userId: string) {
    const removed = await repository.removeQueuedUser(userId);
    if (!removed) {
        return false;
    }

    return true;
}

// Returns matched/queued/not_found state for a given user.
export async function getQueueStatus(userId: string, nowMs = Date.now()): Promise<QueueStatus> {
    const match = await repository.getMatchByUserId(userId);
    if (match) {
        return {
            userId,
            state: 'matched',
            match,
        };
    }

    const entry = await repository.getQueuedUserEntry(userId);
    if (entry) {
        if (isTimedOut(entry, nowMs)) {
            await repository.removeQueuedUser(userId);
            return {
                userId,
                state: 'timed_out',
            };
        }

        return {
            userId,
            state: 'queued',
            entry,
        };
    }

    return {
        userId,
        state: 'not_found',
    };
}

// Flattens all criteria buckets into a single queue snapshot for debugging/admin views.
export async function listQueuedUsers(nowMs = Date.now()) {
    return repository.listQueuedUsers(nowMs);
}

// Clears in-memory state for deterministic tests and local resets.
export async function resetMatchingState() {
    await repository.clear();
}
