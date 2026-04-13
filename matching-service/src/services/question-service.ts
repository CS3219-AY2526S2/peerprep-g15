import { config } from '../config/env';
import type { Difficulty, MatchedQuestion } from '../models/matching-model';

type FetchLike = (input: URL, init?: RequestInit) => Promise<Response>;

let fetchImpl: FetchLike = (input, init) => fetch(input, init);

function logQuestionSelectionFailure(
    reason:
        | 'missing_access_token'
        | 'request_failed'
        | 'non_ok_response'
        | 'invalid_json'
        | 'no_questions_for_difficulty'
        | 'no_questions_for_topic',
    topic: string,
    difficulty: Difficulty,
    details?: Record<string, unknown>,
) {
    console.warn('Question selection failed', {
        reason,
        topic,
        difficulty,
        ...details,
    });
}

export function setQuestionServiceFetch(nextFetch?: FetchLike) {
    fetchImpl = nextFetch ?? ((input, init) => fetch(input, init));
}

function toQuestionDifficulty(difficulty: string) {
    const normalizedDifficulty = difficulty.trim().toLowerCase();

    switch (normalizedDifficulty) {
        case 'easy':
            return 'Easy';
        case 'medium':
            return 'Medium';
        case 'hard':
            return 'Hard';
        default:
            return undefined;
    }
}

function parseQuestions(payload: unknown): MatchedQuestion[] {
    if (!Array.isArray(payload)) {
        return [];
    }

    return payload
        .map((item) => {
            if (!item || typeof item !== 'object') {
                return null;
            }

            const question = item as {
                questionId?: unknown;
                title?: unknown;
                difficulty?: unknown;
                categories?: unknown;
            };
            if (
                typeof question.questionId !== 'number' ||
                typeof question.title !== 'string' ||
                typeof question.difficulty !== 'string' ||
                !Array.isArray(question.categories)
            ) {
                return null;
            }

            const categories = question.categories.filter(
                (category): category is string => typeof category === 'string',
            );

            return {
                questionId: question.questionId,
                title: question.title,
                difficulty: question.difficulty,
                categories,
            };
        })
        .filter((question): question is MatchedQuestion => question !== null);
}

function hasTopic(question: MatchedQuestion, topic: string) {
    const normalizedTopic = topic.trim().toLowerCase();
    return question.categories.some(
        (category) => category.trim().toLowerCase() === normalizedTopic,
    );
}

function pickRandomQuestion(questions: MatchedQuestion[]) {
    return questions[Math.floor(Math.random() * questions.length)];
}

export async function fetchRandomQuestionForMatch(
    topic: string,
    difficulty: Difficulty,
    accessToken?: string,
): Promise<MatchedQuestion | undefined> {
    if (!accessToken) {
        logQuestionSelectionFailure('missing_access_token', topic, difficulty);
        return undefined;
    }

    const questionsUrl = new URL('/questions', config.questionService.baseUrl);
    const questionDifficulty = toQuestionDifficulty(difficulty);
    if (!questionDifficulty) {
        logQuestionSelectionFailure('no_questions_for_difficulty', topic, difficulty, {
            reason: 'invalid_difficulty_value',
        });
        return undefined;
    }

    questionsUrl.searchParams.set('difficulty', questionDifficulty);

    let response: Response;
    try {
        response = await fetchImpl(questionsUrl, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });
    } catch (error) {
        logQuestionSelectionFailure('request_failed', topic, difficulty, {
            questionServiceUrl: questionsUrl.toString(),
            error,
        });
        return undefined;
    }

    if (!response.ok) {
        logQuestionSelectionFailure('non_ok_response', topic, difficulty, {
            status: response.status,
            questionServiceUrl: questionsUrl.toString(),
        });
        return undefined;
    }

    let payload: unknown;
    try {
        payload = await response.json();
    } catch {
        logQuestionSelectionFailure('invalid_json', topic, difficulty, {
            questionServiceUrl: questionsUrl.toString(),
        });
        return undefined;
    }

    const questions = parseQuestions(payload);
    if (questions.length === 0) {
        logQuestionSelectionFailure('no_questions_for_difficulty', topic, difficulty, {
            questionServiceUrl: questionsUrl.toString(),
        });
        return undefined;
    }

    const topicMatchedQuestions = questions.filter((question) => hasTopic(question, topic));
    if (topicMatchedQuestions.length === 0) {
        logQuestionSelectionFailure('no_questions_for_topic', topic, difficulty, {
            questionServiceUrl: questionsUrl.toString(),
            fetchedQuestionCount: questions.length,
        });
        return undefined;
    }

    return pickRandomQuestion(topicMatchedQuestions);
}
