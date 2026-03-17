import mongoose, { Schema } from 'mongoose';

const questionSchema = new Schema(
    {
        questionId: { type: Number, required: true, unique: true },
        title: { type: String, required: true, trim: true },
        description: { type: String, required: true },
        categories: { type: [String], required: true },
        difficulty: {
            type: String,
            enum: ['Easy', 'Medium', 'Hard'],
            required: true,
        },
        sourceUrl: { type: String, default: '' },
    },
    { timestamps: true },
);

export const Question = mongoose.model('Question', questionSchema);
