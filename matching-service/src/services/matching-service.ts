import { randomUUID } from 'crypto';
import {
    MatchHistoryModel,
    MatchModel,
    QueueHistoryModel,
    QueueModel,
    matchDocumentToResult,
    queueDocumentToEntry,
} from '../models/matching-persistence-model';
import type {
    Difficulty,
    MatchRequest,
    MatchResult,
    QueueEntry,
    QueueStatus,
} from '../models/matching-model';
import { fetchRandomQuestionForMatch } from './question-service';

export interface MatchingRepository {
    clear(): Promise<void>;
    purgeTimedOut(nowMs: number): Promise<void>;
    getMatchByUserId(userId: string): Promise<MatchResult | null>;
    getQueuedUserEntry(userId: string): Promise<QueueEntry | null>;
    listQueuedUsers(nowMs: number): Promise<QueueEntry[]>;
    enqueue(entry: QueueEntry): Promise<void>;
    removeQueuedUser(userId: string): Promise<QueueEntry | null>;
    saveMatch(match: MatchResult): Promise<void>;
    endMatch(matchId: string): Promise<boolean>;
    recordQueueEvent(
        entry: QueueEntry,
        eventType: 'queued' | 'matched' | 'left' | 'timed_out',
        nowMs: number,
        matchId?: string,
    ): Promise<void>;
    recordMatchHistory(match: MatchResult): Promise<void>;
    markMatchHistoryEnded(matchId: string, nowMs: number): Promise<void>;
}

const TOPIC_EXPANSION_WAIT_MS = 15_000;
const FIFO_EXPANSION_WAIT_MS = 30_000;
const QUEUE_TIMEOUT_MS = 60_000;
const DIFFICULTY_RANK: Record<Difficulty, number> = {
    easy: 0,
    medium: 1,
    hard: 2,
};

class MongoMatchingRepository implements MatchingRepository {
    async clear() {
        await Promise.all([
            QueueModel.deleteMany({}),
            MatchModel.deleteMany({}),
            QueueHistoryModel.deleteMany({}),
            MatchHistoryModel.deleteMany({}),
        ]);
    }

    async purgeTimedOut(nowMs: number) {
        const cutoff = new Date(nowMs - QUEUE_TIMEOUT_MS);
        await QueueModel.deleteMany({ joinedAt: { $lte: cutoff } });
    }

    async getMatchByUserId(userId: string) {
        const document = await MatchModel.findOne({
            userIds: userId,
            endedAt: { $exists: false },
        }).lean();
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

    async endMatch(matchId: string) {
        const result = await MatchModel.findOneAndDelete({ matchId }).lean();
        return result !== null;
    }

    async recordQueueEvent(
        entry: QueueEntry,
        eventType: 'queued' | 'matched' | 'left' | 'timed_out',
        nowMs: number,
        matchId?: string,
    ) {
        await QueueHistoryModel.create({
            userId: entry.userId,
            topic: entry.topic.trim(),
            difficulty: entry.difficulty,
            eventType,
            matchId,
            occurredAt: new Date(nowMs),
        });
    }

    async recordMatchHistory(match: MatchResult) {
        await MatchHistoryModel.updateOne(
            { matchId: match.matchId },
            {
                $set: {
                    userIds: match.userIds,
                    topic: match.topic.trim(),
                    difficulty: match.difficulty,
                    question: match.question,
                    createdAt: new Date(match.createdAt),
                },
            },
            { upsert: true },
        );
    }

    async markMatchHistoryEnded(matchId: string, nowMs: number) {
        await MatchHistoryModel.updateOne(
            { matchId },
            {
                $set: {
                    endedAt: new Date(nowMs),
                },
            },
        );
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
        const match = this.matchByUserId.get(userId);
        return match && !match.endedAt ? match : null;
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

    async endMatch(matchId: string) {
        let found = false;
        for (const [userId, match] of this.matchByUserId.entries()) {
            if (match.matchId === matchId) {
                this.matchByUserId.delete(userId);
                found = true;
            }
        }
        return found;
    }

    async recordQueueEvent(
        _entry: QueueEntry,
        _eventType: 'queued' | 'matched' | 'left' | 'timed_out',
        _nowMs: number,
        _matchId?: string,
    ) {
        // No-op in memory repository for tests.
    }

    async recordMatchHistory(_match: MatchResult) {
        // No-op in memory repository for tests.
    }

    async markMatchHistoryEnded(_matchId: string, _nowMs: number) {
        // No-op in memory repository for tests.
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

function pickMatchTopic(waitingUserTopic: string, joiningUserTopic: string) {
    const normalizedWaitingTopic = waitingUserTopic.trim().toLowerCase();
    const normalizedJoiningTopic = joiningUserTopic.trim().toLowerCase();

    if (normalizedWaitingTopic === normalizedJoiningTopic) {
        return joiningUserTopic.trim();
    }

    return Math.random() < 0.5 ? waitingUserTopic.trim() : joiningUserTopic.trim();
}

function pickLowerDifficulty(first: Difficulty, second: Difficulty): Difficulty {
    return DIFFICULTY_RANK[first] <= DIFFICULTY_RANK[second] ? first : second;
}

function resolveMatchCriteria(waitingUser: QueueEntry, joiningUser: QueueEntry) {
    return {
        topic: pickMatchTopic(waitingUser.topic, joiningUser.topic),
        difficulty: pickLowerDifficulty(waitingUser.difficulty, joiningUser.difficulty),
    };
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

async function safeRecordQueueEvent(
    entry: QueueEntry,
    eventType: 'queued' | 'matched' | 'left' | 'timed_out',
    nowMs: number,
    matchId?: string,
) {
    try {
        await repository.recordQueueEvent(entry, eventType, nowMs, matchId);
    } catch (error) {
        console.error('Failed to write queue history event', {
            userId: entry.userId,
            eventType,
            matchId,
            error,
        });
    }
}

async function safeRecordMatchHistory(match: MatchResult) {
    try {
        await repository.recordMatchHistory(match);
    } catch (error) {
        console.error('Failed to write match history record', {
            matchId: match.matchId,
            error,
        });
    }
}

async function safeMarkMatchHistoryEnded(matchId: string, nowMs: number) {
    try {
        await repository.markMatchHistoryEnded(matchId, nowMs);
    } catch (error) {
        console.error('Failed to mark match history ended', {
            matchId,
            error,
        });
    }
}

async function ensureMatchHasQuestion(match: MatchResult, accessToken?: string) {
    if (match.question) {
        return match;
    }

    const question = await fetchRandomQuestionForMatch(match.topic, match.difficulty, accessToken);
    if (!question) {
        console.warn('Unable to hydrate question for existing match', {
            matchId: match.matchId,
            topic: match.topic,
            difficulty: match.difficulty,
        });
        return match;
    }

    return {
        ...match,
        question,
    };
}

async function attemptMatchForEntry(
    entry: QueueEntry,
    nowMs: number,
    accessToken: string | undefined,
    joiningUserAlreadyQueued: boolean,
) {
    const queuedUsers = await repository.listQueuedUsers(nowMs);
    const waitingUser = findBestWaitingCandidate(queuedUsers, entry, nowMs);
    if (!waitingUser) {
        return null;
    }

    const criteria = resolveMatchCriteria(waitingUser, entry);
    const question = await fetchRandomQuestionForMatch(
        criteria.topic,
        criteria.difficulty,
        accessToken,
    );

    if (!question) {
        console.warn('Match candidate found but no valid question available, keeping user queued', {
            joiningUserId: entry.userId,
            waitingUserId: waitingUser.userId,
            topic: criteria.topic,
            difficulty: criteria.difficulty,
        });
        return null;
    }

    if (joiningUserAlreadyQueued) {
        const removedJoiningUser = await repository.removeQueuedUser(entry.userId);
        if (!removedJoiningUser) {
            return null;
        }

        const removedWaitingUser = await repository.removeQueuedUser(waitingUser.userId);
        if (!removedWaitingUser) {
            await repository.enqueue(removedJoiningUser);
            return null;
        }
    } else {
        const removedWaitingUser = await repository.removeQueuedUser(waitingUser.userId);
        if (!removedWaitingUser) {
            return null;
        }
    }

    const match: MatchResult = {
        matchId: randomUUID(),
        userIds: [waitingUser.userId, entry.userId],
        topic: criteria.topic,
        difficulty: criteria.difficulty,
        question,
        createdAt: new Date(nowMs).toISOString(),
    };

    await repository.saveMatch(match);
    await Promise.all([
        safeRecordQueueEvent(waitingUser, 'matched', nowMs, match.matchId),
        safeRecordQueueEvent(entry, 'matched', nowMs, match.matchId),
        safeRecordMatchHistory(match),
    ]);

    return match;
}

// Attempts to match immediately from staged policy; otherwise enqueues the user.
export async function joinQueue(request: MatchRequest, nowMs = Date.now(), accessToken?: string) {
    await repository.purgeTimedOut(nowMs);

    const existingMatch = await repository.getMatchByUserId(request.userId);
    if (existingMatch) {
        const hydratedMatch = await ensureMatchHasQuestion(existingMatch, accessToken);
        return { state: 'matched' as const, match: hydratedMatch };
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

    const match = await attemptMatchForEntry(entry, nowMs, accessToken, false);
    if (match) {
        return { state: 'matched' as const, match };
    }

    await repository.enqueue(entry);
    await safeRecordQueueEvent(entry, 'queued', nowMs);

    return { state: 'queued' as const, entry };
}

// Removes a user from queue and reports whether anything was removed.
export async function leaveQueue(userId: string) {
    const removed = await repository.removeQueuedUser(userId);
    if (!removed) {
        return false;
    }

    await safeRecordQueueEvent(removed, 'left', Date.now());

    return true;
}

// Returns matched/queued/timed_out/not_found state for a given user.
export async function getQueueStatus(
    userId: string,
    nowMs = Date.now(),
    accessToken?: string,
): Promise<QueueStatus> {
    const activeMatch = await repository.getMatchByUserId(userId);
    if (activeMatch) {
        const hydratedMatch = await ensureMatchHasQuestion(activeMatch, accessToken);
        return {
            userId,
            state: 'matched',
            match: hydratedMatch,
        };
    }

    const entry = await repository.getQueuedUserEntry(userId);
    if (entry) {
        if (isTimedOut(entry, nowMs)) {
            await repository.removeQueuedUser(userId);
            await safeRecordQueueEvent(entry, 'timed_out', nowMs);
            return {
                userId,
                state: 'timed_out',
            };
        }

        const rematched = await attemptMatchForEntry(entry, nowMs, accessToken, true);
        if (rematched) {
            return {
                userId,
                state: 'matched',
                match: rematched,
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

// Ends a match by matchId and returns whether the match was found and deleted.
export async function endMatch(matchId: string) {
    const removed = await repository.endMatch(matchId);
    if (removed) {
        await safeMarkMatchHistoryEnded(matchId, Date.now());
    }
    return removed;
}

// Flattens all criteria buckets into a single queue snapshot for debugging/admin views.
export async function listQueuedUsers(nowMs = Date.now()) {
    return repository.listQueuedUsers(nowMs);
}

// Clears in-memory state for deterministic tests and local resets.
export async function resetMatchingState() {
    await repository.clear();
}
