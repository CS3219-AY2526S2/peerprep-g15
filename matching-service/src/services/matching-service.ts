import { randomUUID } from 'crypto';
import { getRedis } from '../config/redis';
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
    touchQueuedUserHeartbeat(userId: string, nowMs: number): Promise<QueueEntry | null>;
    listQueuedUsers(nowMs: number): Promise<QueueEntry[]>;
    enqueue(entry: QueueEntry): Promise<void>;
    removeQueuedUser(userId: string): Promise<QueueEntry | null>;
    saveMatch(match: MatchResult): Promise<void>;
    endMatch(matchId: string): Promise<boolean>;
    attemptMatchAtomically?(
        entry: QueueEntry,
        nowMs: number,
        accessToken: string | undefined,
        joiningUserAlreadyQueued: boolean,
    ): Promise<MatchResult | null>;
}

const TOPIC_EXPANSION_WAIT_MS = 15_000;
const WIDE_DIFFICULTY_EXPANSION_WAIT_MS = 30_000;
const HEARTBEAT_FRESHNESS_MS = 20_000;
const QUEUE_TIMEOUT_MS = 60_000;
const DIFFICULTY_RANK: Record<Difficulty, number> = {
    easy: 0,
    medium: 1,
    hard: 2,
};

function normalizeTopic(topic: string) {
    return topic.trim().toLowerCase();
}

function queueKey(topic: string) {
    return `matching:queue:topic:${normalizeTopic(topic)}`;
}

function heartbeatKey() {
    return 'matching:heartbeat';
}

function userKey(userId: string) {
    return `matching:user:${userId}`;
}

function userMatchKey(userId: string) {
    return `matching:userMatch:${userId}`;
}

function matchKey(matchId: string) {
    return `matching:match:${matchId}`;
}

function topicsKey() {
    return 'matching:topics';
}

async function cleanupTopicIfEmpty(topic: string) {
    const redis = getRedis();
    const count = await redis.zCard(queueKey(topic));

    if (count === 0) {
        await redis.sRem(topicsKey(), normalizeTopic(topic));
    }
}

function serializeQueueEntry(entry: QueueEntry) {
    return {
        userId: entry.userId,
        topic: entry.topic.trim(),
        difficulty: entry.difficulty,
        proficiency: entry.proficiency === undefined ? '' : String(entry.proficiency),
        joinedAt: entry.joinedAt,
        lastHeartbeatAt: entry.lastHeartbeatAt ?? entry.joinedAt,
    };
}

function deserializeQueueEntry(data: Record<string, string>): QueueEntry | null {
    if (!data.userId || !data.topic || !data.difficulty || !data.joinedAt) {
        return null;
    }

    return {
        userId: data.userId,
        topic: data.topic,
        difficulty: data.difficulty as Difficulty,
        proficiency: data.proficiency === '' ? undefined : Number(data.proficiency),
        joinedAt: data.joinedAt,
        lastHeartbeatAt: data.lastHeartbeatAt || undefined,
    };
}

function serializeMatch(match: MatchResult) {
    return {
        matchId: match.matchId,
        userIds: JSON.stringify(match.userIds),
        topic: match.topic,
        difficulty: match.difficulty,
        question: match.question ? JSON.stringify(match.question) : '',
        createdAt: match.createdAt,
        endedAt: match.endedAt ?? '',
    };
}

function deserializeMatch(data: Record<string, string>): MatchResult | null {
    if (!data.matchId || !data.userIds || !data.topic || !data.difficulty || !data.createdAt) {
        return null;
    }

    return {
        matchId: data.matchId,
        userIds: JSON.parse(data.userIds) as [string, string],
        topic: data.topic,
        difficulty: data.difficulty as Difficulty,
        question: data.question ? JSON.parse(data.question) : undefined,
        createdAt: data.createdAt,
        endedAt: data.endedAt || undefined,
    };
}

class RedisMatchingRepository implements MatchingRepository {
    async clear() {
        const redis = getRedis();
        const keys = await redis.keys('matching:*');
        if (keys.length > 0) {
            await redis.del(keys);
        }
    }

    async purgeTimedOut(nowMs: number) {
        const redis = getRedis();
        const cutoff = nowMs - QUEUE_TIMEOUT_MS;
        const staleUserIds = await redis.zRangeByScore(heartbeatKey(), 0, cutoff);

        for (const userId of staleUserIds) {
            const entry = await this.getQueuedUserEntry(userId);

            if (!entry) {
                await redis.zRem(heartbeatKey(), userId);
                continue;
            }

            await redis
                .multi()
                .zRem(queueKey(entry.topic), userId)
                .zRem(heartbeatKey(), userId)
                .del(userKey(userId))
                .exec();

            await cleanupTopicIfEmpty(entry.topic);
        }
    }

    async getMatchByUserId(userId: string): Promise<MatchResult | null> {
        const redis = getRedis();
        const matchId = await redis.get(userMatchKey(userId));
        if (!matchId) return null;

        const data = await redis.hGetAll(matchKey(matchId));
        return deserializeMatch(data);
    }

    async getQueuedUserEntry(userId: string): Promise<QueueEntry | null> {
        const redis = getRedis();
        const data = await redis.hGetAll(userKey(userId));
        return deserializeQueueEntry(data);
    }

    async touchQueuedUserHeartbeat(userId: string, nowMs: number): Promise<QueueEntry | null> {
        const redis = getRedis();
        const entry = await this.getQueuedUserEntry(userId);

        if (!entry) return null;

        if (isTimedOut(entry, nowMs)) {
            await redis
                .multi()
                .zRem(queueKey(entry.topic), userId)
                .zRem(heartbeatKey(), userId)
                .del(userKey(userId))
                .exec();

            await cleanupTopicIfEmpty(entry.topic);
            return null;
        }

        const heartbeatIso = new Date(nowMs).toISOString();

        await redis
            .multi()
            .hSet(userKey(userId), { lastHeartbeatAt: heartbeatIso })
            .zAdd(heartbeatKey(), [{ score: nowMs, value: userId }])
            .exec();

        return {
            ...entry,
            lastHeartbeatAt: heartbeatIso,
        };
    }

    async listQueuedUsers(nowMs: number): Promise<QueueEntry[]> {
        await this.purgeTimedOut(nowMs);

        const redis = getRedis();
        const topics = await redis.sMembers(topicsKey());
        const entries: QueueEntry[] = [];

        for (const topic of topics) {
            const userIds = await redis.zRange(queueKey(topic), 0, -1);

            for (const userId of userIds) {
                const entry = await this.getQueuedUserEntry(userId);
                if (entry) {
                    entries.push(entry);
                }
            }
        }

        entries.sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime());

        return entries;
    }

    async enqueue(entry: QueueEntry): Promise<void> {
        const redis = getRedis();
        const joinedAtMs = new Date(entry.joinedAt).getTime();
        const lastHeartbeatMs = new Date(entry.lastHeartbeatAt ?? entry.joinedAt).getTime();

        await redis
            .multi()
            .hSet(userKey(entry.userId), serializeQueueEntry(entry))
            .zAdd(queueKey(entry.topic), [{ score: joinedAtMs, value: entry.userId }])
            .zAdd(heartbeatKey(), [{ score: lastHeartbeatMs, value: entry.userId }])
            .sAdd(topicsKey(), normalizeTopic(entry.topic))
            .exec();
    }

    async removeQueuedUser(userId: string): Promise<QueueEntry | null> {
        const redis = getRedis();
        const entry = await this.getQueuedUserEntry(userId);

        if (!entry) return null;

        await redis
            .multi()
            .zRem(queueKey(entry.topic), userId)
            .zRem(heartbeatKey(), userId)
            .del(userKey(userId))
            .exec();

        await cleanupTopicIfEmpty(entry.topic);
        return entry;
    }

    async saveMatch(match: MatchResult): Promise<void> {
        const redis = getRedis();

        await redis
            .multi()
            .hSet(matchKey(match.matchId), serializeMatch(match))
            .set(userMatchKey(match.userIds[0]), match.matchId)
            .set(userMatchKey(match.userIds[1]), match.matchId)
            .exec();
    }

    async endMatch(matchId: string): Promise<boolean> {
        const redis = getRedis();
        const data = await redis.hGetAll(matchKey(matchId));
        const match = deserializeMatch(data);

        if (!match) return false;

        await redis
            .multi()
            .del(matchKey(matchId))
            .del(userMatchKey(match.userIds[0]))
            .del(userMatchKey(match.userIds[1]))
            .exec();

        return true;
    }

    async attemptMatchAtomically(
        entry: QueueEntry,
        nowMs: number,
        accessToken: string | undefined,
        joiningUserAlreadyQueued: boolean,
    ): Promise<MatchResult | null> {
        await this.purgeTimedOut(nowMs);

        const redis = getRedis();
        const topicUserIds = await redis.zRange(queueKey(entry.topic), 0, -1);

        const queuedUsers: QueueEntry[] = [];
        for (const userId of topicUserIds) {
            const queuedEntry = await this.getQueuedUserEntry(userId);
            if (queuedEntry) {
                queuedUsers.push(queuedEntry);
            }
        }

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
            console.warn('Match candidate found but no valid question available', {
                joiningUserId: entry.userId,
                waitingUserId: waitingUser.userId,
                topic: criteria.topic,
                difficulty: criteria.difficulty,
            });
            return null;
        }

        const watchedKeys = [
            userKey(waitingUser.userId),
            userMatchKey(waitingUser.userId),
            userMatchKey(entry.userId),
            ...(joiningUserAlreadyQueued ? [userKey(entry.userId)] : []),
        ];

        await redis.watch(watchedKeys);

        try {
            const joiningStillQueued = joiningUserAlreadyQueued
                ? await redis.exists(userKey(entry.userId))
                : 1;

            const waitingStillQueued = await redis.exists(userKey(waitingUser.userId));
            const joiningAlreadyMatched = await redis.exists(userMatchKey(entry.userId));
            const waitingAlreadyMatched = await redis.exists(userMatchKey(waitingUser.userId));

            if (
                joiningStillQueued === 0 ||
                waitingStillQueued === 0 ||
                joiningAlreadyMatched === 1 ||
                waitingAlreadyMatched === 1
            ) {
                await redis.unwatch();
                return null;
            }

            const match: MatchResult = {
                matchId: randomUUID(),
                userIds: [waitingUser.userId, entry.userId],
                topic: criteria.topic,
                difficulty: criteria.difficulty,
                question,
                createdAt: new Date(nowMs).toISOString(),
            };

            const tx = redis.multi();

            if (joiningUserAlreadyQueued) {
                tx.zRem(queueKey(entry.topic), entry.userId);
                tx.zRem(heartbeatKey(), entry.userId);
                tx.del(userKey(entry.userId));
            }

            tx.zRem(queueKey(waitingUser.topic), waitingUser.userId);
            tx.zRem(heartbeatKey(), waitingUser.userId);
            tx.del(userKey(waitingUser.userId));

            tx.hSet(matchKey(match.matchId), serializeMatch(match));
            tx.set(userMatchKey(match.userIds[0]), match.matchId);
            tx.set(userMatchKey(match.userIds[1]), match.matchId);

            const result = await tx.exec();

            if (result === null) {
                return null;
            }

            await cleanupTopicIfEmpty(waitingUser.topic);
            if (joiningUserAlreadyQueued) {
                await cleanupTopicIfEmpty(entry.topic);
            }

            return match;
        } finally {
            try {
                await redis.unwatch();
            } catch {}
        }
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

    async touchQueuedUserHeartbeat(userId: string, nowMs: number) {
        for (const [criteriaKey, queue] of this.queueByCriteria.entries()) {
            const index = queue.findIndex((entry) => entry.userId === userId);
            if (index < 0) {
                continue;
            }

            if (isTimedOut(queue[index], nowMs)) {
                queue.splice(index, 1);
                if (queue.length === 0) {
                    this.queueByCriteria.delete(criteriaKey);
                } else {
                    this.queueByCriteria.set(criteriaKey, queue);
                }
                return null;
            }

            queue[index] = {
                ...queue[index],
                lastHeartbeatAt: new Date(nowMs).toISOString(),
            };
            this.queueByCriteria.set(criteriaKey, queue);
            return queue[index];
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
}

let repository: MatchingRepository = new RedisMatchingRepository();

export function createInMemoryMatchingRepository() {
    return new InMemoryMatchingRepository();
}

// Matching policy: t = 0 exact match,
// t = 15s expand to adjacent difficulty within same topic,
// t = 30s expand to any difficulty within same topic, t = 60s timeout.
// Within each stage, longest-waiting eligible user is selected for fairness.
export function setMatchingRepository(nextRepository?: MatchingRepository) {
    repository = nextRepository ?? new RedisMatchingRepository();
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
function getQueuedWaitedMs(entry: QueueEntry, nowMs: number) {
    return Math.max(0, nowMs - new Date(entry.joinedAt).getTime());
}

function getLastActivityAtMs(entry: QueueEntry) {
    return new Date(entry.lastHeartbeatAt ?? entry.joinedAt).getTime();
}

function isEligibleForMatching(entry: QueueEntry, nowMs: number) {
    return Math.max(0, nowMs - getLastActivityAtMs(entry)) <= HEARTBEAT_FRESHNESS_MS;
}

// Determines if a queued user has exceeded the maximum wait time and should be timed out.
function isTimedOut(entry: QueueEntry, nowMs: number) {
    return Math.max(0, nowMs - getLastActivityAtMs(entry)) >= QUEUE_TIMEOUT_MS;
}

function getDifficultyGap(first: Difficulty, second: Difficulty) {
    return Math.abs(DIFFICULTY_RANK[first] - DIFFICULTY_RANK[second]);
}

function isDuplicateQueueEntryError(error: unknown) {
    if (typeof error !== 'object' || error === null) {
        return false;
    }

    if (!('code' in error)) {
        return false;
    }

    return (error as { code?: unknown }).code === 11000;
}

// Removes timed-out users from all queues so they are never considered for matching.
// Assigns candidate stage: 0 exact match, 1 adjacent same-topic after wait,
// 2 any same-topic after longer wait.
function getMatchStage(joiningUser: QueueEntry, candidate: QueueEntry, nowMs: number) {
    if (!isEligibleForMatching(candidate, nowMs)) {
        return null;
    }

    const sameTopic =
        candidate.topic.trim().toLowerCase() === joiningUser.topic.trim().toLowerCase();
    const difficultyGap = getDifficultyGap(candidate.difficulty, joiningUser.difficulty);

    if (sameTopic && difficultyGap === 0) {
        return 0;
    }

    const waitedMs = getQueuedWaitedMs(candidate, nowMs);
    if (sameTopic && difficultyGap === 1 && waitedMs >= TOPIC_EXPANSION_WAIT_MS) {
        return 1;
    }

    if (sameTopic && waitedMs >= WIDE_DIFFICULTY_EXPANSION_WAIT_MS) {
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

function findBestWaitingCandidate(queue: QueueEntry[], joiningUser: QueueEntry, nowMs: number) {
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
            selectedIndex = index;
            selectedStage = stage;
            selectedJoinedAt = joinedAtMs;
        }
    }

    return selectedIndex < 0 ? undefined : queue[selectedIndex];
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

    const hydrated: MatchResult = {
        ...match,
        question,
    };

    await repository.saveMatch(hydrated);
    return hydrated;
}

async function attemptMatchForEntry(
    entry: QueueEntry,
    nowMs: number,
    accessToken: string | undefined,
    joiningUserAlreadyQueued: boolean,
) {
    if (repository.attemptMatchAtomically) {
        return repository.attemptMatchAtomically(
            entry,
            nowMs,
            accessToken,
            joiningUserAlreadyQueued,
        );
    }

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
        if (isTimedOut(existingQueuedEntry, nowMs)) {
            await repository.removeQueuedUser(request.userId);
        } else {
            await repository.touchQueuedUserHeartbeat(request.userId, nowMs);

            const refreshedEntry = await repository.getQueuedUserEntry(request.userId);
            if (refreshedEntry) {
                const rematched = await attemptMatchForEntry(
                    refreshedEntry,
                    nowMs,
                    accessToken,
                    true,
                );

                if (rematched) {
                    return { state: 'matched' as const, match: rematched };
                }

                return { state: 'queued' as const, entry: refreshedEntry };
            }
        }
    }

    const entry: QueueEntry = {
        ...request,
        topic: request.topic.trim(),
        joinedAt: new Date(nowMs).toISOString(),
        lastHeartbeatAt: new Date(nowMs).toISOString(),
    };

    const match = await attemptMatchForEntry(entry, nowMs, accessToken, false);
    if (match) {
        return { state: 'matched' as const, match };
    }

    try {
        await repository.enqueue(entry);
        return { state: 'queued' as const, entry };
    } catch (error) {
        if (!isDuplicateQueueEntryError(error)) {
            throw error;
        }

        const concurrentMatch = await repository.getMatchByUserId(request.userId);
        if (concurrentMatch) {
            const hydratedMatch = await ensureMatchHasQuestion(concurrentMatch, accessToken);
            return { state: 'matched' as const, match: hydratedMatch };
        }

        const existingEntryAfterDuplicate = await repository.getQueuedUserEntry(request.userId);
        if (existingEntryAfterDuplicate) {
            return { state: 'queued' as const, entry: existingEntryAfterDuplicate };
        }

        throw error;
    }
}

// Refreshes liveness for a queued user so inactive ghosts can expire by TTL.
export async function refreshQueueHeartbeat(userId: string, nowMs = Date.now()) {
    await repository.purgeTimedOut(nowMs);

    const touched = await repository.touchQueuedUserHeartbeat(userId, nowMs);
    if (!touched) {
        return false;
    }

    return true;
}

// Removes a user from queue and reports whether anything was removed.
export async function leaveQueue(userId: string) {
    const removed = await repository.removeQueuedUser(userId);
    if (!removed) {
        return false;
    }

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
