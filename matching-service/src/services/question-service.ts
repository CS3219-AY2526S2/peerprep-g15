import { config } from '../config/env';
import type { Difficulty, MatchedQuestion } from '../models/matching-model';

type FetchLike = (input: URL, init?: RequestInit) => Promise<Response>;

let fetchImpl: FetchLike = (input, init) => fetch(input, init);

export function setQuestionServiceFetch(nextFetch?: FetchLike) {
    fetchImpl = nextFetch ?? ((input, init) => fetch(input, init));
}

function toQuestionDifficulty(difficulty: Difficulty) {
    switch (difficulty) {
        case 'easy':
            return 'Easy';
        case 'medium':
            return 'Medium';
        case 'hard':
            return 'Hard';
        default:
            return 'Easy';
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
        return undefined;
    }

    const questionsUrl = new URL('/questions', config.questionService.baseUrl);
    questionsUrl.searchParams.set('difficulty', toQuestionDifficulty(difficulty));

    let response: Response;
    try {
        response = await fetchImpl(questionsUrl, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });
    } catch {
        return undefined;
    }

    if (!response.ok) {
        return undefined;
    }

    let payload: unknown;
    try {
        payload = await response.json();
    } catch {
        return undefined;
    }

    const questions = parseQuestions(payload);
    if (questions.length === 0) {
        return undefined;
    }

    const topicMatchedQuestions = questions.filter((question) => hasTopic(question, topic));
    if (topicMatchedQuestions.length === 0) {
        return undefined;
    }

    return pickRandomQuestion(topicMatchedQuestions);
}
