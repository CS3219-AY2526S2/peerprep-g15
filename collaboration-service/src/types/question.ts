// types/question.ts
export interface Question {
    questionId: string;
    title: string;
    description: string;
    difficulty: string;
    starterCode: Record<string, string>;
    supportedLanguages: string[];
}
