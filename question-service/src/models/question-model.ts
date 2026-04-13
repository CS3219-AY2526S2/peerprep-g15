import mongoose, { Schema } from 'mongoose';

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
        description: { type: String, required: true, trim: true },
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
    { timestamps: true },
);

export const Question = mongoose.model('Question', questionSchema);
