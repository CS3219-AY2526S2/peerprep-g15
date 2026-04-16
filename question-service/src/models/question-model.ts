import crypto from 'crypto';
import mongoose, { Schema } from 'mongoose';
import { inferExecutionSpec, type SeedQuestion } from '../types/execution';

function normalizeText(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[^\p{L}\p{N}\s]/gu, '');
}

function toPlainValue(value: unknown): unknown {
    if (value === null || value === undefined) {
        return null;
    }

    if (Array.isArray(value)) {
        return value.map(toPlainValue);
    }

    if (value instanceof Map) {
        return Object.fromEntries(
            [...value.entries()]
                .sort(([a], [b]) => String(a).localeCompare(String(b)))
                .map(([k, v]) => [k, toPlainValue(v)]),
        );
    }

    if (typeof value === 'object') {
        if (typeof (value as { toObject?: () => unknown }).toObject === 'function') {
            return toPlainValue((value as { toObject: () => unknown }).toObject());
        }

        const obj = value as Record<string, unknown>;
        const sortedKeys = Object.keys(obj).sort();
        const result: Record<string, unknown> = {};

        for (const key of sortedKeys) {
            result[key] = toPlainValue(obj[key]);
        }

        return result;
    }

    return value;
}

function stableStringify(value: unknown): string {
    if (value === null || value === undefined) {
        return 'null';
    }

    if (Array.isArray(value)) {
        return `[${value.map(stableStringify).join(',')}]`;
    }

    if (value instanceof Map) {
        return stableStringify(
            Object.fromEntries([...value.entries()].sort(([a], [b]) => a.localeCompare(b))),
        );
    }

    if (typeof value === 'object') {
        const obj = value as Record<string, unknown>;
        const sortedKeys = Object.keys(obj).sort();
        return `{${sortedKeys.map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`).join(',')}}`;
    }

    return JSON.stringify(value);
}

function buildQuestionFingerprint(doc: {
    title?: string;
    description?: string;
    questionType?: string;
    functionSignature?: unknown;
    designSignature?: unknown;
    sqlTables?: unknown;
    executionSpec?: unknown;
}): string {
    const payload = {
        title: normalizeText(doc.title ?? ''),
        description: normalizeText(doc.description ?? ''),
        questionType: doc.questionType ?? '',
        functionSignature: toPlainValue(doc.functionSignature),
        designSignature: toPlainValue(doc.designSignature),
        sqlTables: toPlainValue(doc.sqlTables) ?? [],
        executionSpec: toPlainValue(doc.executionSpec),
    };

    return crypto.createHash('sha256').update(stableStringify(payload)).digest('hex');
}

const exampleSchema = new Schema(
    {
        input: { type: String, required: true, trim: true },
        output: { type: String, required: true, trim: true },
        explanation: { type: String, default: '', trim: true },
    },
    { _id: false },
);

const functionParamSchema = new Schema(
    {
        name: { type: String, required: true, trim: true },
        type: { type: String, required: true, trim: true },
    },
    { _id: false },
);

const functionSignatureSchema = new Schema(
    {
        name: { type: String, required: true, trim: true },
        returnType: { type: String, default: '', trim: true },
        params: { type: [functionParamSchema], default: [] },
    },
    { _id: false },
);

const designMethodSchema = new Schema(
    {
        name: { type: String, required: true, trim: true },
        returnType: { type: String, default: '', trim: true },
        params: { type: [functionParamSchema], default: [] },
    },
    { _id: false },
);

const designSignatureSchema = new Schema(
    {
        className: { type: String, required: true, trim: true },
        constructorParams: { type: [functionParamSchema], default: [] },
        methods: { type: [designMethodSchema], default: [] },
    },
    { _id: false },
);

const sqlTableSchema = new Schema(
    {
        name: { type: String, required: true, trim: true },
        columns: { type: [String], default: [] },
    },
    { _id: false },
);

const testCaseSchema = new Schema(
    {
        input: { type: Schema.Types.Mixed, required: true },
        expectedOutput: { type: Schema.Types.Mixed, required: true },
        isHidden: { type: Boolean, default: false },
        explanation: { type: String, default: '', trim: true },
        weight: { type: Number, default: 1, min: 0 },
    },
    { _id: false },
);

const designExecutionMethodSchema = new Schema(
    {
        name: { type: String, required: true, trim: true },
        paramNames: { type: [String], default: [] },
        returnType: { type: String, default: '', trim: true },
    },
    { _id: false },
);

const executionSpecSchema = new Schema(
    {
        kind: {
            type: String,
            enum: ['function', 'design', 'stdin', 'sql'],
            required: true,
        },
        className: { type: String, default: '', trim: true },
        methodName: { type: String, default: '', trim: true },
        paramOrder: { type: [String], default: [] },
        returnMode: {
            type: String,
            enum: ['return', 'inplace'],
            default: undefined,
        },
        mutateParamIndex: { type: Number, default: undefined },
        codecs: { type: [String], default: [] },
        constructorParamNames: { type: [String], default: [] },
        methods: { type: [designExecutionMethodSchema], default: [] },
        comparator: {
            type: String,
            enum: ['json', 'float', 'string'],
            default: 'json',
        },
    },
    { _id: false },
);

const questionSchema = new Schema(
    {
        questionId: { type: Number, required: true, unique: true },

        title: { type: String, required: true, trim: true },
        normalizedTitle: { type: String, required: true, trim: true },

        description: { type: String, required: true, trim: true },

        contentFingerprint: { type: String, required: true },

        categories: { type: [String], required: true, default: [] },
        difficulty: {
            type: String,
            enum: ['Easy', 'Medium', 'Hard'],
            required: true,
        },
        questionType: {
            type: String,
            enum: ['function', 'design', 'sql'],
            required: true,
            default: 'function',
        },
        imageUrl: { type: String, default: '', trim: true },
        sourceUrl: { type: String, default: '', trim: true },
        constraints: { type: [String], default: [] },
        hints: { type: [String], default: [] },
        examples: { type: [exampleSchema], default: [] },
        testCases: { type: [testCaseSchema], default: [] },
        supportedLanguages: {
            type: [String],
            default: ['python', 'javascript', 'java', 'cpp'],
        },
        starterCode: { type: Map, of: String, default: {} },
        functionSignature: { type: functionSignatureSchema, default: null },
        designSignature: { type: designSignatureSchema, default: null },
        sqlTables: { type: [sqlTableSchema], default: [] },
        executionSpec: { type: executionSpecSchema, required: true },
        timeLimitMs: { type: Number, default: 2000, min: 100 },
        memoryLimitMb: { type: Number, default: 256, min: 16 },
    },
    {
        timestamps: true,
        optimisticConcurrency: true,
    },
);

questionSchema.pre('validate', function (next) {
    const doc = this as any;

    doc.executionSpec = inferExecutionSpec({
        questionId: doc.questionId,
        title: doc.title,
        description: doc.description,
        categories: doc.categories ?? [],
        difficulty: doc.difficulty,
        questionType: doc.questionType,
        imageUrl: doc.imageUrl ?? '',
        sourceUrl: doc.sourceUrl ?? '',
        constraints: doc.constraints ?? [],
        hints: doc.hints ?? [],
        examples: doc.examples ?? [],
        testCases: doc.testCases ?? [],
        supportedLanguages: doc.supportedLanguages ?? [],
        starterCode: doc.starterCode ?? new Map(),
        functionSignature: doc.functionSignature,
        designSignature: doc.designSignature,
        sqlTables: doc.sqlTables ?? [],
        timeLimitMs: doc.timeLimitMs,
        memoryLimitMb: doc.memoryLimitMb,
    });

    doc.normalizedTitle = normalizeText(doc.title ?? '');

    doc.contentFingerprint = buildQuestionFingerprint({
        title: doc.title,
        description: doc.description,
        questionType: doc.questionType,
        functionSignature: doc.functionSignature,
        designSignature: doc.designSignature,
        sqlTables: doc.sqlTables,
        executionSpec: doc.executionSpec,
    });

    next();
});

questionSchema.index({ normalizedTitle: 1 });
questionSchema.index({ contentFingerprint: 1 }, { unique: true });

export const Question = mongoose.model('Question', questionSchema);
