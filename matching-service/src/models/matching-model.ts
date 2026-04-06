export type Difficulty = 'easy' | 'medium' | 'hard';

export interface MatchedQuestion {
    questionId: number;
    title: string;
    difficulty: string;
    categories: string[];
}

export interface MatchRequest {
    userId: string;
    topic: string;
    difficulty: Difficulty;
    proficiency?: number;
}

export interface QueueEntry extends MatchRequest {
    joinedAt: string;
}

export interface MatchResult {
    matchId: string;
    userIds: [string, string];
    topic: string;
    difficulty: Difficulty;
    question?: MatchedQuestion;
    createdAt: string;
    endedAt?: string;
}

export type QueueState = 'queued' | 'matched' | 'timed_out' | 'not_found';

export interface QueueStatus {
    userId: string;
    state: QueueState;
    entry?: QueueEntry;
    match?: MatchResult;
}
