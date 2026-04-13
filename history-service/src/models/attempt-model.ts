import mongoose, { Schema } from 'mongoose';

export interface AttemptTestCaseResult {
	input?: unknown;
	expected?: unknown;
	actual?: unknown;
	passed: boolean;
	stderr?: string | null;
	compileOutput?: string | null;
	message?: string | null;
	status?: string;
}

export interface AttemptDocument {
	attemptId: string;
	userId: string;
	roomId?: string;
	questionId?: string | number;
	questionTitle?: string;
	language: string;
	code: string;
	passed: boolean;
	results?: AttemptTestCaseResult[];
	error?: string | null;
	submittedAt: Date;
}

const attemptResultSchema = new Schema<AttemptTestCaseResult>(
	{
		input: { type: Schema.Types.Mixed },
		expected: { type: Schema.Types.Mixed },
		actual: { type: Schema.Types.Mixed },
		passed: { type: Boolean, required: true },
		stderr: { type: String, default: null },
		compileOutput: { type: String, default: null },
		message: { type: String, default: null },
		status: { type: String, default: '' },
	},
	{ _id: false },
);

const attemptSchema = new Schema<AttemptDocument>(
	{
		attemptId: { type: String, required: true, unique: true, index: true },
		userId: { type: String, required: true, index: true },
		roomId: { type: String, default: '' },
		questionId: { type: Schema.Types.Mixed },
		questionTitle: { type: String, default: '' },
		language: { type: String, required: true },
		code: { type: String, required: true },
		passed: { type: Boolean, required: true, index: true },
		results: { type: [attemptResultSchema], default: [] },
		error: { type: String, default: null },
		submittedAt: { type: Date, required: true, index: true },
	},
	{ versionKey: false },
);

attemptSchema.index({ userId: 1, submittedAt: -1 });

export const AttemptModel = mongoose.model<AttemptDocument>('HistoryAttempt', attemptSchema, 'attempt_history');